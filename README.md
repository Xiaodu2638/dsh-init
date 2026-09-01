# dsh-init

给 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 加上 Claude Code 风格的 **`/init` 命令**的 Cordis 插件。

运行后通过「访谈 → 侦查代码库 → 补缺口 → 写文件」的工作流，生成：

1. **`CLAUDE.md`** — 极简的项目级 agent 指引（含 Claude Code 标准文件头）；
2. **`AGENTS.md`** — **不生成第二份内容**，而是创建一条指向 `CLAUDE.md` 的**相对软链接**，让读 AGENTS.md 的工具（含 DSH 自身、Cursor、Codex 等）和读 CLAUDE.md 的工具共享同一份事实来源。

## 设计

Claude Code 的 `/init` 没有一行"生成逻辑"——它是 `type: 'prompt'` 的内置命令，`getPromptForCommand()` 只返回一段静态工作流提示词，其余全部由模型用普通工具（读写文件、提问、子代理）完成。本插件沿用完全相同的架构：

- 插件只注册一个名为 **`init`** 的模型 Tool；
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

### 方式一：挂载到组合（推荐，重启后仍在）

把本仓库放到 DSH 可访问的位置，在 agent 预设的组合文件（如 `~/.dsh/.agent-presets/<id>/agent.cordis.yml`）里加一行插件行：

```yaml
- id: dsh-init
  name: dsh-init
```

`name` 需要能被 DSH 的插件加载器解析（npm 包名或可解析的模块路径）。本包对 `@deepseek-ai/dsh-tools` 是**可选 peer 依赖**：加载不到时自动退回普通对象定义，不影响注册。

### 方式二：会话内动态插件（临时验证用）

在 DSH 会话里用 `cordis_define` + `cordis_run` 把 `src/index.js` 的逻辑作为动态 Package 激活，即插即用，进程重启后消失。

## 使用

对 agent 说任意一句：

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

## License

MIT
