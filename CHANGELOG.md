# Changelog

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
