#!/usr/bin/env node
// kitchen-test covers the install/probe lever with fixtures: idempotency,
// probe three-state verdicts, host filtering, dry-run, and frontmatter
// parsing. Run with `node --test scripts/kitchen-test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildPayload, applyPlan, HOSTS, targetDirFor } from "./kitchen-install.mjs";
import { parseFrontmatter, probeHost } from "./kitchen-probe.mjs";

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kitchen-test-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(path.join(repo, "skills", "alpha", "references"), { recursive: true });
  fs.mkdirSync(path.join(repo, "skills", "beta"), { recursive: true });
  fs.mkdirSync(path.join(repo, "docs", "harness"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, "skills", "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: test skill alpha\n---\nalpha body\n",
  );
  fs.writeFileSync(path.join(repo, "skills", "alpha", "references", "x.md"), "x reference\n");
  fs.writeFileSync(
    path.join(repo, "skills", "beta", "SKILL.md"),
    "---\nname: beta\ndescription: test skill beta\n---\nbeta body\n",
  );
  fs.writeFileSync(path.join(repo, "docs", "harness", "kitchen.md"), "adapter doc\n");
  const hostsRoot = path.join(root, "hosts");
  return { root, repo, hostsRoot };
}

test("buildPayload collects skills and adapter docs with rel paths", () => {
  const { repo } = makeFixture();
  const payload = buildPayload(repo);
  const rels = payload.map((f) => f.rel.split(path.sep).join("/")).sort();
  assert.deepEqual(rels, ["_kitchen-adapter/kitchen.md", "alpha/SKILL.md", "alpha/references/x.md", "beta/SKILL.md"]);
});

test("install is idempotent and byte-identical on rerun", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  const first = applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  assert.equal(first.zcode.written, 4, "first run writes every payload file");
  const second = applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  assert.equal(second.zcode.written, 0, "rerun writes nothing");
  assert.equal(second.zcode.skipped, 4, "rerun skips every file");
  const a = fs.readFileSync(path.join(hostsRoot, "zcode", "alpha", "SKILL.md"));
  const b = fs.readFileSync(path.join(repo, "skills", "alpha", "SKILL.md"));
  assert.ok(a.equals(b), "installed bytes equal source bytes");
});

test("probe reports ok, missing, and drifted", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  assert.equal(probeHost("zcode", payload, { targetRoot: hostsRoot }).status, "ok", "fresh install probes ok");
  fs.rmSync(path.join(hostsRoot, "zcode", "beta", "SKILL.md"));
  const missing = probeHost("zcode", payload, { targetRoot: hostsRoot });
  assert.equal(missing.status, "missing", "absent file reports missing");
  assert.equal(missing.absent, 1);
  applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  fs.appendFileSync(path.join(hostsRoot, "zcode", "alpha", "references", "x.md"), "drift\n");
  const drifted = probeHost("zcode", payload, { targetRoot: hostsRoot });
  assert.equal(drifted.status, "drifted", "byte difference reports drifted");
  assert.equal(drifted.drifted, 1);
});

test("broken frontmatter reports drifted", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  fs.writeFileSync(path.join(hostsRoot, "zcode", "beta", "SKILL.md"), "no fence at all\n");
  const r = probeHost("zcode", payload, { targetRoot: hostsRoot });
  assert.equal(r.status, "drifted", "unparseable frontmatter reports drifted");
});

test("parseFrontmatter accepts well-formed headers and rejects broken ones", () => {
  const good = parseFrontmatter("---\nname: x\ndescription: y\n---\nbody");
  assert.equal(good.ok, true);
  assert.equal(good.name, "x");
  assert.equal(good.hasDescription, true);
  assert.equal(parseFrontmatter("text without fence").ok, false);
  assert.equal(parseFrontmatter("---\ndescription: missing name\n---\n").ok, false);
  assert.equal(parseFrontmatter("---\nname: never closed").ok, false);
});

test("host filter touches only the selected host", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  applyPlan(["zcode", "agents"], payload, { targetRoot: hostsRoot });
  const agentsDir = path.join(hostsRoot, "agents");
  const before = fs.readdirSync(agentsDir).sort();
  applyPlan(["zcode"], payload, { targetRoot: hostsRoot });
  assert.deepEqual(fs.readdirSync(agentsDir).sort(), before, "agents dir untouched");
  assert.ok(!fs.existsSync(path.join(hostsRoot, "codex")), "unselected host never created");
});

test("dry-run plans without writing", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  const r = applyPlan(["zcode"], payload, { targetRoot: hostsRoot, dryRun: true });
  assert.equal(r.zcode.mode, "dry-run");
  assert.equal(r.zcode.planned, 4);
  assert.ok(!fs.existsSync(path.join(hostsRoot, "zcode")), "dry-run leaves no directory");
});

test("dsh stays verify-only without force", () => {
  const { repo, hostsRoot } = makeFixture();
  const payload = buildPayload(repo);
  const r = applyPlan(["dsh"], payload, { targetRoot: hostsRoot });
  assert.equal(r.dsh.mode, "verify-only");
  assert.ok(!fs.existsSync(path.join(hostsRoot, "dsh")), "verify-only writes nothing");
  const forced = applyPlan(["dsh"], payload, { targetRoot: hostsRoot, force: true });
  assert.equal(forced.dsh.written, 4, "force writes the payload");
});

test("HOSTS table covers the four kitchen hosts", () => {
  assert.deepEqual(Object.keys(HOSTS), ["zcode", "codex", "agents", "dsh"]);
  assert.equal(HOSTS.dsh.verifyOnly, true);
  assert.match(targetDirFor("codex", {}), /codex|wsl/, "wsl host resolves to a wsl path form");
});

test("wsl-stdin targets are native posix paths, never UNC", () => {
  for (const host of ["codex", "agents", "dsh"]) {
    const t = targetDirFor(host, { mode: "wsl-stdin" });
    assert.ok(t.startsWith("/"), `${host} wsl-stdin target is absolute posix: ${t}`);
    assert.ok(!t.includes("\\"), `${host} wsl-stdin target has no backslash: ${t}`);
    assert.ok(!t.includes("wsl$"), `${host} wsl-stdin target is not a UNC path: ${t}`);
  }
});
