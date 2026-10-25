# Rollout receipts 2026-10-25

Curated evidence for the kitchen rollout, PR-4. Full lane receipts live outside
the repo at kitchen-receipts/pr-4/ during the run; this directory keeps the
load-bearing pieces.

- probe-zcode-codex-agents.json. The three-host probe verdict, all ok, exit 0.
- lane3-codex-live.txt. Codex headless ran the adapter live: matched a playbook,
  listed its first two steps, produced a host mapping and a Skipped line.
- lane6-dsh-live.txt. dsh headless profile exists and takes stdin, blocked at
  MISSING_CREDENTIAL (DEEPSEEK_API_KEY). Skill consumption unproven behind
  that gate; operator item.
