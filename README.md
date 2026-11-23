# dsh-init

[GitHub](https://github.com/evanfang0054/dsh-init) · [npm](https://www.npmjs.com/package/dsh-init)

给 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 加上 Claude Code 风格的 **`/init` 命令**的官方机制插件（profile bundle）。

安装后，对 agent 说 `/init` 即可通过「访谈 → 侦查代码库 → 补缺口 → 写文件」的工作流生成：

1. **`AGENTS.md`** — 极简的项目级 agent 指引。这是**唯一**生成的指令文件：DSH、Claude Code、Cursor、Codex、Copilot 等所有主流 agent 都读它，一份内容全生态通吃。
2. **`AGENTS.local.md`**（可选）— 你自己的私有偏好文件，自动加进 `.gitignore`。

**不再生成 `CLAUDE.md`。** Claude Code 自己已读 `AGENTS.md`，旧的 CLAUDE.md 约定对新项目已弃用；再维护第二份文件只会产生内容漂移。如果仓库里**已有** CLAUDE.md，工作流会把它当作迁移输入：其中仍然有效的内容先并入 AGENTS.md，然后询问是删除、保留还是改成指向 AGENTS.md 的指针（删除前若有无损内容，先备份为 `CLAUDE.md.bak`）。

## 设计

Claude Code 的 `/init` 没有一行"生成逻辑"——它是 `type: 'prompt'` 的内置命令，`getPromptForCommand()` 只返回一段静态工作流提示词，其余全部由模型用普通工具（读写文件、提问、子代理）完成。本插件沿用完全相同的架构：

- 插件只注册一个名为 **`init`** 的模型 Tool（经 `ctx.tools.register` 挂入工具注册表）；
- Tool `execute()` 零参数、零业务逻辑，返回工作流提示词；
- 提示词改编自 Claude Code `NEW_INIT` 八阶段流程（逆向自 [claude-code-map](https://github.com/HaiDong-Once/claude-code-map) 的 `src/commands/init.ts`），按 DSH 能力裁剪为七阶段，并把产物从 CLAUDE.md 改为 AGENTS.md。

### 工作流七阶段

| 阶段 | 内容 |
| --- | --- |
| 1 访谈 | 问范围：项目 AGENTS.md / 个人 AGENTS.local.md / 两者 |
| 2 侦查 | 读 manifest、README、CI、已有的 AGENTS.md / 旧 CLAUDE.md / .cursor rules 等 |
| 3 补缺口 | 只问代码答不了的问题，不标"推荐" |
| 4 写 AGENTS.md | 每行过"删掉会导致 agent 犯错吗"测试；已有文件走 diff 不覆盖 |
| 5 退役 CLAUDE.md | 仅在存在时触发：有效内容并入 AGENTS.md → 询问删除 / 保留 / 改成指针；绝不静默删内容 |
| 6 AGENTS.local.md | 可选个人偏好文件 + 自动加 .gitignore |
| 7 总结 | 回顾产物，说明 CLAUDE.md 的去向，提醒可随时重跑 |

### 为什么砍掉软链

0.1.x 的做法是「写 CLAUDE.md，再建一条指向它的 AGENTS.md 相对软链」。这有两个问题：

- **主文件是弃用约定的那个**——生态已经收敛到 AGENTS.md，软链却让真正的文件仍然叫 CLAUDE.md；
- **软链跨平台易碎**——Windows 要开发者模式、git 要 `core.symlinks true`，clone / 检出后经常退化成普通文件或干脆丢失。

现在主文件就是 AGENTS.md，不需要任何链接。**相对普通的单个文件同样能进 git，且到处都能 checkout 成功。**

## 安装

本包是一个标准的 **DSH profile bundle**（`package.json` 声明 `dsh.bundle.patch`，与官方 `@deepseek-ai/dsh-base`、社区 `dsh-context` 等插件同一机制）。用 DSH 自带的 `dsh plugin` 命令安装（内部转发 pnpm，并把本包加入 profile 的 bundle 层）：

```bash
# 方式一：从 npm 安装（推荐）
dsh plugin --profile web add dsh-init

# 方式二：从 GitHub 安装（建议 pin commit hash）
dsh plugin --profile web add "github:evanfang0054/dsh-init#<commit>"

# 方式三：从本地仓库安装（web profile；GUI 部署的默认 profile）
dsh plugin --profile web add /path/to/dsh-init
```

然后**重启 DSH**（bundle 层在进程启动时加载）。

验证安装成功：

```bash
cat ~/.dsh/profiles/web/package.json | grep dsh-init
# "dsh.profile.bundles" 数组里出现 "dsh-init" 即已挂载
```

卸载：

```bash
dsh plugin --profile web remove dsh-init
```

> 从本地路径安装时，pnpm 会自动以 **link（软链）** 方式挂入——仓库里改完代码，重启 DSH 即生效，无需重新 add。

### 安装机制说明

- `dsh plugin add` = 在 `~/.dsh/profiles/<profile>/` 里跑 `pnpm add <spec>`，然后根据安装结果把声明了 `dsh.bundle` 的包写进该 profile 清单的 `dsh.profile.bundles` 层栈；
- 启动时各 bundle 的 `cordis.patch.yml` 按层栈顺序应用（本包只插入一行 `- id: dsh-init / name: dsh-init`），后写的层覆盖同 id 行；
- 本包**零依赖**：工具定义以规范化形态直接注册，不需要 `@deepseek-ai/dsh-tools`。

## 使用

安装并重启后，插件向会话注册**两个面**（同一套工作流）：

- **斜杠命令 `/init`**：输入 `/` 即可在补全列表看到 `init`（Claude Code 同款体验）。选中回车后，工作流提示词作为你的下一个用户回合注入，agent 立即开始访谈与生成。`/init <附加要求>` 可附带补充说明。
- **模型工具 `init`**：直接用自然语言说"初始化这个项目"，agent 调用工具拿到工作流提示词开始执行。

## 注意事项

- **已有 AGENTS.md**：工作流绝不静默覆盖——会先读、再以 diff 形式提出具体改动。
- **已有 CLAUDE.md**：视为迁移输入。有效内容先并进 AGENTS.md，然后经用户确认才删除 / 保留 / 改成指针；删除前若有无损内容先备份 `CLAUDE.md.bak`。
- **AGENTS.local.md**：写入后自动追加到 `.gitignore`，不会进仓库。
- **更新插件**：本地路径安装是软链，改完仓库代码重启 DSH 即生效；GitHub/npm 安装则重新执行一次 `dsh plugin add <spec>` 更新到新版本（GitHub 方式需换成新的 commit hash）。

## 从 0.1.x 升级

0.1.x 生成的是 `CLAUDE.md` + `AGENTS.md` 软链。升级到 0.2.0 后：

```bash
dsh plugin --profile desktop add dsh-init@0.2.0
# 重启 DSH
```

然后对已有项目重跑一次 `/init`：它会把 CLAUDE.md（或那条软链）作为迁移输入处理，并把内容落到真正的 `AGENTS.md` 上。想让改动立刻生效而不重跑，也可以手动执行：

```bash
# 软链情形（旧版产物）
cat AGENTS.md > AGENTS.md.tmp && rm AGENTS.md && mv AGENTS.md.tmp AGENTS.md

# 然后留下真正的 AGENTS.md，CLAUDE.md / 旧软链按需删除
rm CLAUDE.md
```

## 发布新版本（GitHub Actions 自动化）

发布由 GitHub Actions 全自动完成（与 [dsh-mermaid-zoom](https://github.com/evanfang0054/dsh-mermaid-zoom) 同一套模式）：推送 `v*` tag 触发流水线——语法检查 → 插件加载冒烟测试 → `npm publish`（token 取自仓库 secret `NPM_TOKEN`）。也支持在 Actions 页面手动触发（workflow_dispatch）。

```bash
npm run release        # = npm version patch（bump + commit + tag）+ git push --follow-tags
```

推完 tag 后 CI 自动发布到 npm，进度见仓库 Actions 页。

> 前置配置（仓库维护者）：`gh secret set NPM_TOKEN --body <npm token>`，token 与 `~/.npmrc` 无关，仅存于 GitHub 仓库 secret。

## License

MIT
