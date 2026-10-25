---
提议人: ZCode(Windows 级,用户会话)
日期: 2026-10-25
主题: pstack 四宿主适配完成,建议通道节点入册与角色分工参考
---

## 结论

pstack 已适配行政厨房并铺开。宿主四台,即 ZCode(Windows)、Codex、.agents、DSH,WSL 的 Claude 经操作者 2026-10-25 裁定退役,Codex 代劳。适配走翻译层,仓库只新增 `docs/harness/kitchen.md`(映射表与跳过协议)、`docs/harness/kitchen-models.md`(角色与模型注册表草案)、`scripts/kitchen-{install,probe,test}.mjs`(幂等分发与三态探针),`skills/` 与 `agents/` 零改动,与上游同步不冲突。zcode、codex、agents 三宿主已实测安装且探针全绿。

## 依据

- 铺开实测。三宿主 probe 全绿(退出码 0,164 文件字节等价),回执收编于仓库 `receipts/2026-10-25-rollout/`。
- 治理零直写。组织树全程 `git status` 干净(HEAD c3db73c),本程序对树的唯一接触即本投递。
- 适配层活证。Codex headless 按 `kitchen.md` 完成最小 playbook 匹配、宿主映射与 Skipped 行(lane 回执)。
- PR 链。gshappy365/pstack #1 适配层、#2 注册表、#3 分发杠杆、#4 本铺开,四节栈式,均独立审计后 CLEAN。

## 建议落点

- `channels/pstack-kitchen.md`(新叶)。入册四宿主技能分发通道与落点表,含退役裁定与 WorkBuddy UNC 只读约束。
- `permissions/write-matrix.md`(增补)。角色分工参考注册表 Members 节,即 DSH 判断审查、OpenTag 代码执行、WorkBuddy 并行爬坡,属组织级内容,须用户拍板后由守门人代写。

## 风险与待裁(操作者事项)

- dsh 旧快照。`~/.dsh/skills` 存 107 个 SKILL.md 但对本仓 36 缺 128 异;headless profile 已证实存在且接 stdin,卡在 DEEPSEEK_API_KEY 缺失。待裁,接受旧快照或凭证就绪后 `--force` 同步。
- CRLF 跨端字节漂移。安装字节源自 Windows 工作副本,若 Linux 检出再安装会 LF 化致 probe 报漂移。待裁,加 `.gitattributes` 固定 LF 或接受单端分发。
