# AGENTS.md

This file provides guidance to coding agents (DSH, Claude Code, Cursor, Codex, …) when working with code in this repository.

## What this is

A zero-dependency DeepSeek Harness (DSH) **profile bundle** that registers `/init`: an `init` slash command plus an `init` model Tool, both injecting one static workflow prompt. There is no build step and no runtime dependency — `lib/index.js` is shipped as-is (`"files"` lists it, `main` points at it).

Neither face has business logic. The command's handler queues the prompt as the agent's next user turn via `agent.followup()`; the tool's `execute()` just returns it. All real work — surveying the repo, asking questions, writing files — is done by the agent that receives the prompt, using ordinary tools. Keep it that way: logic added here runs inside the host process, while the same behaviour written into the prompt is inspectable and editable by users.

## Verifying a change

There is **no test script and no test file** in this repo. CI runs three inline `node -e` one-liners; run the same ones locally before pushing:

```bash
node --check lib/index.js
node -e "import('./lib/index.js').then(m => { if (m.name !== 'dsh-init' || typeof m.apply !== 'function' || !Array.isArray(m.inject)) process.exit(1); console.log('plugin load OK:', m.name); }).catch(e => { console.error(e); process.exit(1); })"
node -e "const p=require('./package.json'); if(!p.name||!p.version||!p.license||!p.dsh.bundle.patch) process.exit(1); console.log('package.json OK:', p.name, p.version)"
```

The load check is the important one: a syntax error and a broken export shape both surface there, and either one makes the host refuse to load the bundle at startup — which, on Desktop, means the window does not open at all rather than a clean error.

To verify what the *prompt* says, read the rendered `INIT_PROMPT` template literal rather than eyeballing the source: it is one long backtick string full of escaped backticks, and a change can silently alter what the model sees while the source still looks right.

## Conventions

- Commit messages follow Conventional Commits (`feat:`, `docs:`, `feat!:` for breaking). Bodies explain why, wrapped at ~76 columns.
- Version bumps are manual in `package.json`; there is no `npm version` step in CI. Tags are `v<major>.<minor>.<patch>`.
- `CHANGELOG.md` gets a dated `## <version> — <YYYY-MM-DD>` section per release, describing behaviour, not a diff.
- `README.md` is written in Chinese and documents user-facing behaviour; update it whenever the workflow's phases or its produced files change.

## Publishing

`.github/workflows/publish.yml` publishes to npm on any `v*` tag push (plus manual `workflow_dispatch`), gated on the three checks above. It needs the repo secret `NPM_TOKEN`.

**Before running `npm run release`, read this.** That script is `npm version patch && git push --follow-tags`, and `branch.main.remote` is `origin`, which points at the **upstream** `evanfang0054/dsh-init` — not this fork (`fork`). On a fork, `npm run release` therefore tries to push the version commit and tag to a repository this account cannot write to. Push to the fork explicitly instead:

```bash
git push fork main --follow-tags
```

The same caution applies to `npm publish` itself: the package name `dsh-init` is already taken on npm by upstream, so publishing this fork under that name will fail. Publishing requires renaming the package first, which also means changing the `name` in `cordis.patch.yml` to match.

## Gotchas

- This repo's current `.gitignore` lists `node_modules/`, `*.log`, `.DS_Store`, and `.npmrc`. It does **not** yet list `AGENTS.local.md`: the generated workflow only adds that line to a *target* project that chose personal scope, never to this one. Never commit `.npmrc` — it holds npm credentials.
- The bundle patch inserts a row whose `id` and `name` must both stay `dsh-init`; the loader matches on them, and the package name in `package.json` is what resolves the module. If you rename the package, update all three.
- The tool and command are both named `init`. DSH commands never reach the model, so the two faces overlap deliberately — but a change to one usually belongs in the other, and in `INIT_PROMPT` itself rather than in either wrapper.
