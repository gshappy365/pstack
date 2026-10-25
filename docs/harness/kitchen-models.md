# pstack kitchen role-model registry(角色与模型注册表)

会话开始时随 `docs/harness/kitchen.md` 一起读一次。行是 pstack 全部角色,列是四宿主取值加成员映射建议。取值依据 kitchen.md Models 节实测。本表在仓库内是草案,组织级内容入树须经用户拍板,成员列不改变 permissions/write-matrix 的写入授权。Default 列保留上游两支默认 slug 作基准(`grok-4.7-xhigh-fast`、`claude-opus-5-5-xhigh`)。删一行即回退该角色的 Default 列,宿主须声明 missing。

宿主取值记号,四宿主均无 per-model 派发。`inherit-parent` 即随父会话模型,派发省略 `model` 参数并声明(ZCode,实测 Task 不收 model)。`inherit-session` 即 Codex 会话级 `-c model=<slug>` 或 `~/.codex/config.toml`,无 per-subagent,未设时随会话;角色行由 config.toml 与 AGENTS.md 承担(Appendix E 裁定,不生成 rules 模板)。`inherit-runtime` 即 .agents 模型随宿主运行时,派发随父会话。`profile-stack` 即 DSH 模型由 profile 层栈决定,机制未证实,只读待证。

## Registry

| Role | Default | ZCode | Codex | .agents | DSH | Members |
| --- | --- | --- | --- | --- | --- | --- |
| code | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | OpenTag |
| judgment and prose | `claude-opus-5-5-xhigh` | inherit-parent | inherit-session | inherit-runtime | profile-stack | DSH |
| hardest tasks | `claude-opus-5-5-xhigh` | inherit-parent | inherit-session | inherit-runtime | profile-stack | DSH |
| swarm workers | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | WorkBuddy |
| how critics | `grok-4.7-xhigh-fast`(近缘 how explorer) | inherit-parent | inherit-session | inherit-runtime | profile-stack | DSH |
| reviewers | `claude-opus-5-5-xhigh` + `grok-4.7-xhigh-fast`(interrogate 面板) | inherit-parent | inherit-session | inherit-runtime | profile-stack | DSH |
| bug-fix | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | OpenTag |
| feature, refactoring | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | OpenTag |
| perf-issue | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | OpenTag |
| hillclimb | `grok-4.7-xhigh-fast` | inherit-parent | inherit-session | inherit-runtime | profile-stack | WorkBuddy |

## Members

成员列是建议草案,与组织树 permissions/write-matrix 分工不冲突。DSH 承担判断与审查,即 judgment and prose、hardest tasks、how critics、reviewers。OpenTag 承担代码执行,即 code、bug-fix、feature, refactoring、perf-issue。WorkBuddy 承担并行与爬坡,即 swarm workers、hillclimb,经 UNC 只读访问不强装。执行写入仍限 DSH 与 OpenTag 经 write prepare/finish,组织级拍板归用户,Muse、Hark 素材走投递箱,均不因本表改变。

## Budget and effort tiers

# budget: large (xhigh)

推理档位梯子 `max` > `xhigh` > `high` > `medium` > `low`;`-fast` 后缀是速度档不是推理档,紧急(CI 或 trunk 红、有人阻塞)才用,验证例外恒随 swarm workers 的模型与速度。无 per-model 派发的宿主上,档位作用于会话整体;按任务升降档只动推理档与 fast 位,不动角色族。预算档裁剪全员 effort token 的规则沿用上游 `setup-pstack`。

## DSH skills status(PR-1 lane-5 新事实)

`~/.dsh/skills` 已含 pstack 全套 107 个 SKILL.md,含 poteto-help 与 poteto-mode,接入机制仍未证实,保持只读,验证归 PR-4 Lane 6。证实前本表 DSH 列一律 profile-stack 待证。
