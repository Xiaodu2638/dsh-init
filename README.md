# dsh-init

[GitHub](https://github.com/Xiaodu2638/dsh-init) · 源自 [evanfang0054/dsh-init](https://github.com/evanfang0054/dsh-init)

给 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 加上 Claude Code 风格的 **`/init` 命令**：访谈你、侦查代码库，然后生成一份极简的 **`AGENTS.md`**。

安装后，对 agent 说 `/init` 即可走完「访谈 → 侦查 → 补缺口 → 写文件」的工作流，产出：

1. **`AGENTS.md`** — 极简的项目级 agent 指引，也是**唯一**生成的指令文件。DSH、Claude Code、Cursor、Codex、Copilot 等主流 agent 都读它，一份内容全生态通吃。
2. **`AGENTS.local.md`**（可选）— 你自己的私有偏好文件，自动加进 `.gitignore`。

> **本仓库是 fork。** 相对上游的主要改动是：生成 `AGENTS.md` 而非已弃用的 `CLAUDE.md`，并彻底移除 `AGENTS.md → CLAUDE.md` 软链；仓库里已有的 CLAUDE.md 会被当作迁移输入处理。

## 为什么不再生成 CLAUDE.md

Claude Code 自己已读 `AGENTS.md`，旧的 CLAUDE.md 约定对新项目已弃用；再维护第二份文件只会产生内容漂移。

0.1.x 的做法是「写 CLAUDE.md，再建一条指向它的 AGENTS.md 相对软链」。这有两个问题：

- **主文件是弃用约定的那个** — 生态已经收敛到 AGENTS.md，软链却让真正的文件仍然叫 CLAUDE.md；
- **软链跨平台易碎** — Windows 要开发者模式、git 要 `core.symlinks true`。实测在未开开发者模式的 Windows 上链接根本创建不出来，AGENTS.md 会退化成一份独立副本，两份内容各改各的。

现在主文件就是 AGENTS.md，一个普通文件：能进 git、任何平台都能 checkout 成功、不需要任何链接。

如果仓库里**已有** CLAUDE.md，工作流会把它当作迁移输入：其中仍然有效的内容先并入 AGENTS.md，然后询问是删除、保留，还是改成指向 AGENTS.md 的指针。删除前若有无损内容，先备份为 `CLAUDE.md.bak` — 绝不静默删内容。

## 设计

Claude Code 的 `/init` 没有一行「生成逻辑」——它是 `type: 'prompt'` 的内置命令，`getPromptForCommand()` 只返回一段静态工作流提示词，其余全部由模型用普通工具（读写文件、提问、子代理）完成。本插件沿用完全相同的架构：

- 提示词改编自 Claude Code `NEW_INIT` 八阶段流程（逆向自 [claude-code-map](https://github.com/HaiDong-Once/claude-code-map) 的 `src/commands/init.ts`），按 DSH 能力裁剪为七阶段，产物指向 AGENTS.md；
- 插件向会话注册**两个面**，共用同一段提示词：
  - 斜杠命令 `init`（经 `ctx.commands.register`）— 让 `/init` 出现在输入框补全列表；
  - 模型 Tool `init`（经 `ctx.tools.register`）— 让 agent 能从自然语言「初始化这个项目」自行发起。
- 两个面都不携带业务逻辑：`execute()` 零参数、返回提示词；命令 handler 把提示词作为下一个普通用户回合注入（`agent.followup()`），这正是 Claude Code「注入提示词，模型干活」的语义。

### 工作流七阶段

| 阶段 | 内容 |
| --- | --- |
| 1 访谈 | 一次询问两件事：范围（项目 AGENTS.md / 个人 AGENTS.local.md / 两者）+ **回复语言** |
| 2 侦查 | 读 manifest、README、CI、已有的 AGENTS.md / 旧 CLAUDE.md / .cursor rules 等 |
| 3 补缺口 | 只问代码答不了的问题，不标「推荐」 |
| 4 写 AGENTS.md | 每行过「删掉会导致 agent 犯错吗」测试；已有文件走 diff 不覆盖；指名语言时写一行 Communication |
| 5 退役 CLAUDE.md | 仅在存在时触发：有效内容并入 AGENTS.md → 询问删除 / 保留 / 改成指针 |
| 6 AGENTS.local.md | 可选个人偏好文件 + 自动加 .gitignore |
| 7 总结 | 回顾产物，说明 CLAUDE.md 去向与语言选择的结果，提醒可随时重跑 |

### 回复语言：只管回答，不管思考

第 1 阶段的访谈会一并询问**回复用什么语言**。这个选择只约束**你看到的回答**——提问、改动说明、总结——不涉及模型的思维链（reasoning）语言。

- **默认「跟随我的消息」**：什么都不写进 AGENTS.md。agent 本来就会跟随对话语言，写一行反而是噪声。
- **指名语言**（如简体中文）：在 AGENTS.md 里加一节，且措辞明确把约束限定在回答上：

  ```markdown
  ## Communication
  - Reply in 简体中文. Reasoning/thinking may use any language; this concerns visible answers, not internal reasoning.
  ```

  第二句不是装饰。光写「用中文回复」常被后续读到这份文件的 agent 过度解读成「连思考也用中文」,所以这里把边界写死;而且这一行固定用英文表述,让读 AGENTS.md 的任何 agent 都能准确理解。

思维链语言本身**不会**被写进 AGENTS.md:它是按会话、按模型走的，指令文件管不到它,写进去只会让仓库里的事实来源出现一句假话。标识符、路径、命令、URL、报错文本在任何情况下都保持原文。

## 安装

本包是一个标准的 **DSH profile bundle**（`package.json` 声明 `dsh.bundle.patch`），与官方 `@deepseek-ai/dsh-base` 等插件同一机制。它**零依赖**，也不需要构建步骤。

> 本 fork 未发布到 npm，请从 GitHub 或本地路径安装。上游的 npm 包 `dsh-init` 仍是 0.1.x 行为（生成 CLAUDE.md）。

安装路径取决于你的 DSH 是否带 CLI：

**A. Desktop 版（没有 `dsh` 命令）— 用 GUI 或让 agent 代劳**

Desktop 安装（Electron 应用）不注册 `dsh` 命令，不要照着 `dsh plugin` 的文档敲，会得到 "command not found"。改用插件自带的 `plugin_manager` 工具，或等价地打开 **Plugins** 页面操作：

```text
plugin_manager install_bundle  target: github:Xiaodu2638/dsh-init#<commit>
```

本地路径安装则把 `target` 换成 `/path/to/dsh-init`。已装过旧版时须先移除：

```text
plugin_manager remove_bundle   target: dsh-init
plugin_manager install_bundle  target: /path/to/dsh-init
```

**B. Web / CLI 版（`dsh` 命令可用）**

```bash
# 从 GitHub 安装（建议 pin commit hash，分支名可变）
dsh plugin --profile web add "github:Xiaodu2638/dsh-init#<commit>"

# 或从本地仓库安装（pnpm 会以 link 方式挂入）
dsh plugin --profile web add /path/to/dsh-init
```

然后**重启 DSH**（bundle 层在进程启动时加载）。

验证安装成功：

```bash
cat ~/.dsh/profiles/<profile>/package.json | grep dsh-init
# "dsh.profile.bundles" 数组里出现 "dsh-init" 即已挂载
```

卸载：`dsh plugin --profile web remove dsh-init`（Desktop 用 `plugin_manager remove_bundle`）。

### 安装机制说明

- `dsh plugin add` = 在 `~/.dsh/profiles/<profile>/` 里跑 `pnpm add <spec>`，然后根据安装结果把声明了 `dsh.bundle` 的包写进该 profile 清单的 `dsh.profile.bundles` 层栈；
- 启动时各 bundle 的 `cordis.patch.yml` 按层栈顺序应用（本包只插入一行 `- id: dsh-init / name: dsh-init`），后写的层覆盖同 id 行；
- 从本地路径安装时，pnpm 以 **link** 方式挂入——仓库里改完代码，重启 DSH 即生效，无需重新 add。注意这也是软链，只是 DSH 插件加载器不挑平台。

## 使用

安装并重启后：

- **斜杠命令 `/init`**：输入 `/` 即可在补全列表看到 `init`。选中回车后，工作流提示词作为你的下一个用户回合注入，agent 立即开始访谈与生成。`/init <附加要求>` 可附带补充说明。
- **模型工具 `init`**：直接用自然语言说「初始化这个项目」，agent 调用工具拿到工作流提示词开始执行。

## 注意事项

- **已有 AGENTS.md**：工作流绝不静默覆盖——会先读，再以 diff 形式提出具体改动。
- **已有 CLAUDE.md**：视为迁移输入，经用户确认后才删除 / 保留 / 改成指针；删除前若有无损内容先备份 `CLAUDE.md.bak`。
- **AGENTS.local.md**：写入后自动追加到 `.gitignore`，不会进仓库。
- **更新插件**：本地路径安装是 link，改完仓库代码重启 DSH 即生效；GitHub 安装则重新执行一次 `add`，并换成新的 commit hash。

## 从 0.1.x 升级

0.1.x 生成的是 `CLAUDE.md` + `AGENTS.md` 软链（在 Windows 上通常是两份独立副本）。升级后：

```bash
# Desktop：plugin_manager remove_bundle + install_bundle
dsh plugin --profile web add "github:Xiaodu2638/dsh-init#<commit>"
# 重启 DSH
```

然后对已有项目重跑一次 `/init`：它会把 CLAUDE.md（或那条软链）当作迁移输入，把内容落进真正的 `AGENTS.md`，并询问旧文件如何处理。

不想重跑、只想手动收尾的话，注意**旧文件的内容仍带 `# CLAUDE.md` 头**，要一并改掉。若 AGENTS.md 其实是一份独立副本，两份文件可能已被单独编辑过，**先比对再合并**：

```bash
# bash
head -1 AGENTS.md                 # 确认首行是不是 # CLAUDE.md
cp -L AGENTS.md AGENTS.md.real    # -L 穿透软链读取
mv AGENTS.md.real AGENTS.md
rm CLAUDE.md
```

```powershell
# PowerShell 等价写法
Get-Content AGENTS.md -TotalCount 1         # 确认首行是不是 # CLAUDE.md
Copy-Item AGENTS.md AGENTS.md.real -Force   # 目标非软链，直接读实体内容
Move-Item AGENTS.md.real AGENTS.md -Force
Remove-Item CLAUDE.md
```

最后把首行标题 `# CLAUDE.md` 改成 `# AGENTS.md`，并调整开头那段指引文案。

## 发布新版本

本 fork 沿用上游的 tag 触发流程（`.github/workflows/publish.yml`）：推送 `v*` tag 触发流水线——语法检查 → 插件加载冒烟测试 → `npm publish`。

```bash
npm run release        # = npm version patch + git push --follow-tags
```

> **从 fork 发布前必须先改包名。** `dsh-init` 这个名字在上游 npm 包已属于发布者，同名的后来者无法发布；请改用 scoped 名（如 `@xiaodu2638/dsh-init`）。另外 fork 默认不带上游的 `NPM_TOKEN` secret，需要在 fork 的 Actions 里自行配置，否则流水线会失败。

## License

MIT（与上游一致）。
