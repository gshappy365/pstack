#!/usr/bin/env node
// kitchen-probe verifies each host carries the payload byte-identical to the
// repo and that every SKILL.md frontmatter parses. One JSON report, exit code
// is the verdict. Reads through the same paths install writes, so probing a
// WSL host from Windows goes over \\wsl$ and never spawns wsl.exe.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOSTS, buildPayload, targetDirFor, repoRoot } from "./kitchen-install.mjs";

export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { ok: false, reason: "no opening fence" };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { ok: false, reason: "no closing fence" };
  const head = text.slice(3, end);
  const name = /^name:\s*(.+)$/m.exec(head);
  if (!name) return { ok: false, reason: "no name field" };
  const desc = /^description:\s*(.+)$/m.exec(head);
  return { ok: true, name: name[1].trim(), hasDescription: Boolean(desc) };
}

function countSkillFiles(dir) {
  let n = 0;
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.name === "SKILL.md") n++;
    }
  }
  return n;
}

export function probeHost(host, payload, opts = {}) {
  const target = targetDirFor(host, opts);
  const result = { host, target, status: "ok", absent: 0, drifted: 0, details: [] };
  if (!fs.existsSync(target)) {
    return { ...result, status: "missing", reason: "skills dir absent" };
  }
  for (const f of payload) {
    const dest = path.join(target, f.rel);
    let bytes;
    try {
      bytes = fs.readFileSync(dest);
    } catch {
      result.absent++;
      if (result.details.length < 20) result.details.push(`absent ${f.rel}`);
      continue;
    }
    if (!bytes.equals(fs.readFileSync(f.abs))) {
      result.drifted++;
      if (result.details.length < 20) result.details.push(`drifted ${f.rel}`);
    }
  }
  for (const f of payload) {
    if (!f.rel.endsWith("SKILL.md")) continue;
    const dest = path.join(target, f.rel);
    let text;
    try {
      text = fs.readFileSync(dest, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(text);
    if (!fm.ok) {
      result.drifted++;
      if (result.details.length < 20) result.details.push(`frontmatter ${f.rel}: ${fm.reason}`);
    }
  }
  result.skills = countSkillFiles(target);
  if (result.absent > 0) result.status = "missing";
  else if (result.drifted > 0) result.status = "drifted";
  return result;
}

function main() {
  const hosts = [];
  const opts = { targetRoot: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--host") hosts.push(argv[++i]);
    else if (argv[i] === "--target-root") opts.targetRoot = argv[++i];
    else if (argv[i] === "--all") {
      // no-op: default already probes all hosts
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("kitchen-probe: verify hosts carry the payload byte-identical with parseable frontmatter. Exit 0 only when every host is ok.");
      console.log("--host <name> (repeatable; default all). --target-root DIR (fixtures). --all.");
      return;
    } else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (hosts.length === 0) hosts.push(...Object.keys(HOSTS));
  const payload = buildPayload(repoRoot());
  const results = hosts.map((h) => probeHost(h, payload, opts));
  const ok = results.every((r) => r.status === "ok");
  console.log(JSON.stringify({ payload: payload.length, ok, hosts: results }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
