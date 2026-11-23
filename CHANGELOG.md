# Changelog

## 0.2.0 — 2026-11-23

- **BREAKING (behavior): the workflow now produces `AGENTS.md`, not
  `CLAUDE.md`.** Claude Code reads AGENTS.md itself and the CLAUDE.md
  convention is deprecated for new setups, so the generated file is now the
  single tool-agnostic instruction file.
- Dropped the `AGENTS.md` → `CLAUDE.md` relative symlink entirely. The old
  arrangement made the deprecated name the real file and depended on
  developer mode on Windows / `core.symlinks` in git; a plain AGENTS.md needs
  neither and survives every clone.
- New **Phase 5: Retire a legacy CLAUDE.md** — when a repo still has one, its
  still-valid content is folded into AGENTS.md first, then the user chooses to
  delete / keep / convert it to a pointer. Never deleted silently; lossless
  content is backed up as `CLAUDE.md.bak`.
- Personal scope file is now `AGENTS.local.md` (was `CLAUDE.local.md`),
  still auto-added to `.gitignore`.
- Updated command/tool descriptions, package description and keywords.

## 0.1.2 — 2026-09-01

- Register the `/init` slash command: it now appears in the composer's `/`
  autocomplete. DSH commands never reach the model, so the handler queues the
  workflow prompt as the agent's next ordinary user turn (`agent.followup()`).
- `/init <text>` appends the text as "Additional focus".

## 0.1.1 — 2026-09-01

- CI: tag-triggered npm publish via GitHub Actions (`NPM_TOKEN` secret).

## 0.1.0 — 2026-09-01

- Initial release: `init` model Tool + `/init` workflow.
- Seven-phase workflow adapted from Claude Code's NEW_INIT prompt: interview →
  codebase survey → gap-fill → minimal CLAUDE.md → AGENTS.md relative symlink →
  optional CLAUDE.local.md → summary.
