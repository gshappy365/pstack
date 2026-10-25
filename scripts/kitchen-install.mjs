#!/usr/bin/env node
// kitchen-install distributes the pstack skill tree and the kitchen adapter
// docs into each host's skills directory. Reruns write only what differs.
//
// Hosts live in the HOSTS table. Windows hosts and WSL hosts both write
// through the filesystem, WSL via the \\wsl$ UNC path, so the default path
// spawns no child process. --wsl-stdin switches WSL hosts to a single
// `wsl bash -s` script over stdin for callers without UNC access.
// The DSH host is verify-only: its directory already carries the full set
// and belongs to the dsh profile stack, so writes require --force.
//
// Usage: node scripts/kitchen-install.mjs [--host zcode|codex|agents|dsh]...
//        [--dry-run] [--wsl-stdin] [--unc] [--force] [--target-root DIR]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const WSL_DISTRO = process.env.KITCHEN_WSL_DISTRO || "Ubuntu";
export const WSL_HOME = process.env.KITCHEN_WSL_HOME || "/home/gao";

export const HOSTS = {
  zcode: { label: "ZCode(Windows)", kind: "win", dir: path.join(os.homedir(), ".zcode", "skills") },
  codex: { label: "Codex(WSL)", kind: "wsl", dir: `${WSL_HOME}/.codex/skills` },
  agents: { label: ".agents(WSL)", kind: "wsl", dir: `${WSL_HOME}/.agents/skills` },
  dsh: { label: "DSH(WSL)", kind: "wsl", dir: `${WSL_HOME}/.dsh/skills`, verifyOnly: true },
};

export const ADAPTER_DOCS = ["kitchen.md", "kitchen-models.md"];

export function repoRoot() {
  return path.dirname(HERE);
}

function walkFiles(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(abs, base, out);
    else out.push({ rel: path.relative(base, abs), abs });
  }
}

export function buildPayload(root = repoRoot()) {
  const files = [];
  const skillsRoot = path.join(root, "skills");
  for (const skill of fs.readdirSync(skillsRoot)) {
    const skillDir = path.join(skillsRoot, skill);
    if (!fs.statSync(skillDir).isDirectory()) continue;
    walkFiles(skillDir, skillsRoot, files);
  }
  for (const doc of ADAPTER_DOCS) {
    const abs = path.join(root, "docs", "harness", doc);
    if (fs.existsSync(abs)) files.push({ rel: path.join("_kitchen-adapter", doc), abs });
  }
  return files;
}

export function targetDirFor(host, opts = {}) {
  if (opts.targetRoot) return path.join(opts.targetRoot, host);
  const h = HOSTS[host];
  if (h.kind === "win" || process.platform !== "win32") return h.dir;
  if (opts.mode === "wsl-stdin") return h.dir;
  return `\\\\wsl$\\${WSL_DISTRO}\\${h.dir.replace(/^\//, "").replace(/\//g, "\\")}`;
}

function applyViaFs(target, actions) {
  let written = 0;
  let skipped = 0;
  for (const a of actions) {
    const dest = path.join(target, a.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const bytes = fs.readFileSync(a.abs);
    let same = false;
    try {
      same = fs.readFileSync(dest).equals(bytes);
    } catch {
      same = false;
    }
    if (same) {
      skipped++;
      continue;
    }
    const tmp = `${dest}.ktmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, dest);
    written++;
  }
  return { mode: "fs", target, written, skipped, total: actions.length };
}

function applyViaStdin(host, target, actions) {
  const lines = ["set -eu"];
  for (const a of actions) {
    const rel = a.rel.split(path.sep).join("/");
    const dest = `${target}/${rel}`;
    const dir = dest.slice(0, dest.lastIndexOf("/"));
    const b64 = fs.readFileSync(a.abs).toString("base64");
    lines.push(`mkdir -p '${dir}'`);
    lines.push(
      `if printf %s '${b64}' | base64 -d | cmp -s - '${dest}'; then :; else printf %s '${b64}' | base64 -d > '${dest}.ktmp' && mv '${dest}.ktmp' '${dest}' && echo W '${dest}'; fi`,
    );
  }
  const res = spawnSync("wsl", ["bash", "-s"], {
    input: `${lines.join("\n")}\n`,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`wsl-stdin failed for ${host}: ${res.stderr}`);
  const written = (res.stdout.match(/^W /gm) || []).length;
  return { mode: "wsl-stdin", target, written, skipped: actions.length - written, total: actions.length };
}

export function applyPlan(hosts, payload, opts = {}) {
  const report = {};
  for (const host of hosts) {
    const h = HOSTS[host];
    if (!h) throw new Error(`unknown host: ${host}`);
    const target = targetDirFor(host, opts);
    if (opts.dryRun) {
      report[host] = { mode: "dry-run", target, planned: payload.length };
      continue;
    }
    if (h.verifyOnly && !opts.force) {
      report[host] = {
        mode: "verify-only",
        target,
        note: "DSH dir belongs to the dsh profile stack and already carries the set; --force to write",
      };
      continue;
    }
    const actions = payload.map((f) => ({ ...f }));
    report[host] =
      opts.mode === "wsl-stdin" && h.kind === "wsl" && process.platform === "win32"
        ? applyViaStdin(host, target, actions)
        : applyViaFs(target, actions);
  }
  return report;
}

function parseArgs(argv) {
  const opts = { hosts: [], mode: "fs", force: false, dryRun: false, targetRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--host") opts.hosts.push(argv[++i]);
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--wsl-stdin") opts.mode = "wsl-stdin";
    else if (a === "--unc") opts.mode = "fs";
    else if (a === "--force") opts.force = true;
    else if (a === "--target-root") opts.targetRoot = argv[++i];
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (opts.hosts.length === 0) opts.hosts = Object.keys(HOSTS);
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("kitchen-install: copy skills/ and adapter docs into host skill dirs. Idempotent.");
    console.log("--host <name> (repeatable; default all). --dry-run. --wsl-stdin. --unc. --force (enables dsh writes). --target-root DIR (fixtures).");
    console.log("Hosts: zcode (win), codex, agents, dsh (verify-only). dsh stays read-only because the dir is harness-managed and already complete.");
    return;
  }
  const payload = buildPayload();
  const report = applyPlan(opts.hosts, payload, opts);
  console.log(JSON.stringify({ payload: payload.length, hosts: report }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
