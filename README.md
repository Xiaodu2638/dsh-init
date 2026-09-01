# dsh-init

[GitHub](https://github.com/evanfang0054/dsh-init) · [npm](https://www.npmjs.com/package/dsh-init)

给 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 加上 Claude Code 风格的 **`/init` 命令**的官方机制插件（profile bundle）。

安装后，对 agent 说 `/init` 即可通过「访谈 → 侦查代码库 → 补缺口 → 写文件」的工作流生成：

1. **`CLAUDE.md`** — 极简的项目级 agent 指引（含 Claude Code 标准文件头）；
2. **`AGENTS.md`** — **不生成第二份内容**，而是创建一条指向 `CLAUDE.md` 的**相对软链接**，让读 AGENTS.md 的工具（含 DSH 自身、Cursor、Codex 等）和读 CLAUDE.md 的工具共享同一份事实来源。

## 设计

Claude Code 的 `/init` 没有一行"生成逻辑"——它是 `type: 'prompt'` 的内置命令，`getPromptForCommand()` 只返回一段静态工作流提示词，其余全部由模型用普通工具（读写文件、提问、子代理）完成。本插件沿用完全相同的架构：

- 插件只注册一个名为 **`init`** 的模型 Tool（经 `ctx.tools.register` 挂入工具注册表）；
- Tool `execute()` 零参数、零业务逻辑，返回工作流提示词；
- 提示词改编自 Claude Code `NEW_INIT` 八阶段流程（逆向自 [claude-code-map](https://github.com/HaiDong-Once/claude-code-map) 的 `src/commands/init.ts`），按 DSH 能力裁剪为七阶段，并新增 **Phase 5: AGENTS.md 软链**。

### 工作流七阶段

| 阶段 | 内容 |
| --- | --- |
| 1 访谈 | 问范围：项目 CLAUDE.md / 个人 CLAUDE.local.md / 两者 |
| 2 侦查 | 读 manifest、README、CI、已有的 CLAUDE.md / AGENTS.md / .cursor rules 等 |
| 3 补缺口 | 只问代码答不了的问题，不标"推荐" |
| 4 写 CLAUDE.md | 每行过"删掉会导致 agent 犯错吗"测试；已有文件走 diff 不覆盖 |
| 5 软链 AGENTS.md | `ln -s CLAUDE.md AGENTS.md`；已存在常规文件时先 diff、经确认再替换，绝不静默删内容 |
| 6 CLAUDE.local.md | 可选个人偏好文件 + 自动加 .gitignore |
| 7 总结 | 回顾产物，提醒可随时重跑 |

## 安装

本包是一个标准的 **DSH profile bundle**（`package.json` 声明 `dsh.bundle.patch`，与官方 `@deepseek-ai/dsh-base`、社区 `dsh-context` 等插件同一机制）。用 DSH 自带的 `dsh plugin` 命令安装（内部转发 pnpm，并把本包加入 profile 的 bundle 层）：

```bash
# 方式一：从 npm 安装（推荐）
dsh plugin --profile web add dsh-init

# 方式二：从 GitHub 安装
dsh plugin --profile web add github:evanfang0054/dsh-init

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

安装并重启后，在任意项目目录对 agent 说：

```
/init
初始化这个项目
跑一下 init
```

模型会调用 `init` 工具拿到工作流提示词，然后开始访谈与生成。

## 注意事项

- **软链与 git**：git 原生保存 symlink（模式 120000），clone 后链接保持。Windows 需开启开发者模式并设置 `git config core.symlinks true`。
- **已有 AGENTS.md**：工作流绝不静默覆盖——会先 diff，再经用户确认，可选备份为 `AGENTS.md.bak`。
- **CLAUDE.md 变更**：因为 AGENTS.md 是软链，改 CLAUDE.md 即同时生效于两边，永远不需要改两份。
- **更新插件**：本地路径安装是软链，改完仓库代码重启 DSH 即生效；GitHub/npm 安装则重新执行一次 `dsh plugin add <spec>` 更新到新版本。

## 发布新版本（本地自动化）

本仓库配置了一条命令的本地发布流水线：

```bash
npm run release
```

等价于：`npm version patch`（bump 版本 + git commit + tag）→ `npm publish`（自动触发 `prepublishOnly` 加载校验，走 `publishConfig` 指定的官方源）→ `git push --follow-tags`。

前置条件：`~/.npmrc` 中配置官方源的 token（`//registry.npmjs.org/:_authToken=...`，仓库外的用户级配置，切勿提交进仓库）。

## License

MIT
