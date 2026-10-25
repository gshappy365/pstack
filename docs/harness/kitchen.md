# pstack in the kitchen(行政厨房适配层)

pstack skills use Cursor names. 行政厨房的宿主没有 Cursor。会话开始时读一次本文件,用下表把技能里的 Cursor 名映射到所在宿主。`<pstack>` 指装着 `skills/` 与 `docs/` 的目录。Cursor 字段无对应行时,丢弃该字段并声明;永不传宿主 schema 拒绝的字段。适配只加本文件,`skills/` 与 `agents/` 零改动。宿主四台:ZCode(Windows)、Codex、.agents、DSH。WSL Claude Code 由操作者 2026-10-25 裁定退役,Codex 代劳其 WSL 侧技能执行,`~/.claude` 既有安装保留不动、不再作为目标宿主。标注"实测"的行均验证于 2026-10-25。

## Tools

### ZCode(Windows)

| Cursor | ZCode |
| --- | --- |
| `Task` | 会话的子代理派发工具。可用类型 `general-purpose` 与 `Explore`,无 `poteto-agent`(实测)。 |
| `AskQuestion` | `AskUserQuestion`。 |
| Open a todolist | `TodoWrite`。 |
| Run another pstack skill | `Skill` 工具,按技能清单名调用。清单名取自 SKILL.md 的 frontmatter `name`,不是目录名:实测 `Skill poteto-mode` 报 not found(子代理会话报 not allowed for subagent),`Skill Poteto Mode`(安装副本 frontmatter name)成功。以清单为准。 |
| `Grep`, `Glob` | 无此工具,`Bash` 里用 `rg`。 |
| `/loop` | 无。整点循环用 `CronCreate` 建等价整点任务,tick 提示词逐字。 |

### Codex

| Cursor | Codex |
| --- | --- |
| `Task` | 无子代理工具。会话内顺序执行;需并行时开多个 `codex exec` 进程。 |
| `AskQuestion` | headless 无交互。按 never-block-on-the-human 继续,留占位并声明。 |
| Open a todolist | 回复内列表,每阶段更新。 |
| Run another pstack skill | 无斜杠前缀。读 `~/.codex/skills/<name>/SKILL.md` 后照做。 |
| `Grep`, `Glob` | shell 里 `rg`。 |

### .agents

技能即目录加 SKILL.md,由所在 agent 运行时读文件加载,无斜杠命令面。调用技能 = 读 `~/.agents/skills/<name>/SKILL.md` 并照做。工具面由宿主运行时决定,最低集合是 shell 与文件读写。与既有 context-tree、wigolo 技能共存(实测),只增目录,不改既有内容。

### DSH

`dsh [--profile] <name>` 引导 DeepSeek Harness profile(实测 `~/.dsh/profiles`:headless、wdeb、web)。技能接入机制未证实,只读不配;未证实前按只读注册表降级。会话内工具由 profile 决定。

## Subagent fields

### ZCode(Windows)

| Cursor | ZCode |
| --- | --- |
| `subagent_type: generalPurpose` | `general-purpose`。 |
| `poteto-agent`, `comment-sicko` | 无此类型。委派用 `general-purpose`,brief 附 poteto-mode 的 SKILL.md 路径并要求先读;comment 审查由会话内自审代行。 |
| `readonly: true` | `Explore`,brief 写明 do not edit files,事后 `git status` 复核。 |
| `readonly: false` | `general-purpose`。 |
| `environment: "cloud"` | 无 cloud。改本地 worktree 或独立目录,brief 指明分支。 |
| `run_in_background: true` | 省略,派发即后台。 |
| `model` / `resume` / `file_attachments` | `model` 无此参数(见 Models);`resume` 重派并把先前结果贴进 brief;附件路径写进 brief。 |

### Codex

无 Task 字段。需要隔离时,新起 `codex exec` 于独立工作目录或 worktree,先前结果贴进 prompt。

### .agents

无子代理规格。委派 = 新会话,brief 附 SKILL.md 路径。

### DSH

未证实,不派子代理。

## Models

### ZCode(Windows)

无 per-model 派发(实测):`Task` 不收 `model` 参数,子代理随会话模型。一切 Cursor slug(`grok-4.7-xhigh-fast`、`claude-opus-5-5-xhigh` 等)省略 model 并声明。判断类工作留在主会话。角色分档见 `docs/harness/kitchen-models.md`(建库中),未就绪时用技能默认行。

### Codex

会话模型经 `-c model=<slug>` 或 `~/.codex/config.toml`;无 per-subagent 模型。Cursor slug 不通用,省略并声明,由用户给宿主 slug。默认行同上。

### .agents

模型由宿主运行时决定,省略 model 概念,派发随父会话。

### DSH

模型由 profile 层栈决定;未证实,只读。

## Paths

共享行:`https://github.com/cursor/plugins/blob/main/pstack/<path>` → 仓库内 `<pstack>/<path>`,读本地副本,不 fetch。

### ZCode(Windows)

| Cursor | ZCode |
| --- | --- |
| `~/.cursor/skills/` | `~/.zcode/skills/`(用户级,实测已装)。 |
| `~/.cursor/rules/*.mdc` | 无 .mdc。always-applied 规则走 `~/.zcode/AGENTS.md` 与项目指令。 |
| 转录路径 | 无固定转录目录,回执落文本文件。 |

### Codex

| Cursor | Codex |
| --- | --- |
| `~/.cursor/skills/` | `~/.codex/skills/`。 |
| `~/.cursor/rules/*.mdc` | 无 rules 目录。always-applied 规则走 `AGENTS.md`。 |
| 配置 | `~/.codex/config.toml`。 |

### .agents

| Cursor | .agents |
| --- | --- |
| `~/.cursor/skills/` | `~/.agents/skills/`,与 context-tree、wigolo 共存。 |

### DSH

profiles 在 `$DSH_HOME/profiles`(实测 `~/.dsh/profiles`)。技能目录接入点未证实,不写。

## Cursor-only features

跳过协议:一步需要 Cursor 专属机制时,回一行 `Skipped in kitchen: <步骤>. <原因>.`,然后继续下一步。不停、不问、不重试。后续步骤需要被跳过步骤的产物时留占位,并在该行点名。

| Cursor 机制 | 降级 |
| --- | --- |
| `make-bot-ui` 的 Grok Bot webhook 与 sender-key 交接 | 页面按普通前端实现,webhook 与密钥留占位,不接 Grok Bot、不配 Tailscale。 |
| `automations/benny`(Cursor Automations) | 无 Automations。Slack 只收非敏感提议(见治理映射);复现修复由宿主会话手动触发执行。 |
| `bugbot` | 无。PR 审查走 `interrogate` 与 swarm lane。 |
| `worktree-cleanup` | `git worktree list` 人工核对后 prune,merged/abandoned 判定门保留。 |
| `Task` 参数 `model`、`subagent_type`、`readonly`、`run_in_background`、`environment: "cloud"` | 按 Subagent fields 各宿主行;映射不了的参数丢弃并声明。 |
| `poteto-agent`、`comment-sicko` 子代理 | 见 Subagent fields;comment 审查会话内自审。 |
| Custom Mode | 技能按单次调用;长任务在会话指令里常驻。 |
| `/loop` | ZCode 用 `CronCreate`;其余宿主用各自调度或人工 tick,提示词逐字。 |
| `cursor-team-kit`(`deslop`、`control-cli`、`control-ui`) | 各留一行 Skipped,继续。 |
| `AskQuestion`(宿主无交互时) | 纯文本提问,或按 never-block-on-the-human 继续。 |
| 内置 `create-skill` | 读 `skills/poteto-mode/playbooks/authoring-a-skill.md` 代行。 |
| `/add-plugin` 市场 | 按目录复制安装(分发杠杆)。 |
| `~/.cursor/rules/*.mdc` | 见 Paths 各宿主行。 |
| cloud agent | 本地 worktree,见 Subagent fields。 |
| Cursor 模型 slug 体系(`grok-4.7-xhigh-fast`、`claude-opus-5-5-xhigh` 等) | 见 Models 各宿主行。 |

## Governance(治理映射)

pstack 的治理步骤默认落在 Cursor 工作区,行政厨房按下列映射。程序成员零直写组织树。

| 事项 | 映射 |
| --- | --- |
| 落树步骤(playbook 要求写入组织树) | 只产素材。写一份 Markdown 到投递箱 `/home/gao/506wsl/docs/inbox/`:frontmatter 记提议人、日期、主题;正文 = 结论 + 依据 + 建议落点。不调 `write prepare`/`write finish`,不对树 `git commit`。 |
| 写门槛两问 | Action:会改变未来成员的行为吗。Durability:触发工作重做后它仍成立吗。任一为否即不写,空操作合法。判定归守门人,程序只投递。 |
| 执行写入 | `write prepare`/`write finish` 仅守门人(DSH、OpenTag);组织级内容须用户拍板。 |
| Slack 红线 | 跨频道搜索覆盖私聊与群聊,对 bot 无真私密。敏感素材与待拍板决策不走 Slack,走投递箱;Slack 提议仅限非敏感内容。 |
| 两级权威 | 决策权威归组织树(Context Tree),现状权威归实测。冲突按此判定,不发明第三权威。 |
| 成员通道 | Muse、Hark 经投递箱交素材(只投递,不写树);WorkBuddy 经 UNC 或 Slack。 |
