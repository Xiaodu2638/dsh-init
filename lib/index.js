/**
 * dsh-init — Claude Code style `/init` command for the DeepSeek Harness (DSH).
 *
 * Registers TWO faces for the same workflow, mirroring Claude Code's builtin
 * `/init` (a type: 'prompt' command whose only job is injecting a prompt):
 *
 *   1. A slash COMMAND `init` — appears in the composer's `/` autocomplete.
 *      DSH commands never reach the model, so the handler queues the workflow
 *      prompt as the agent's next ordinary user turn via `agent.followup()`,
 *      which is exactly Claude Code's "inject prompt, model does the work"
 *      semantic.
 *   2. A model TOOL `init` — same prompt; lets the agent start the workflow
 *      from a natural-language ask ("初始化这个项目").
 *
 * Neither face carries business logic: the agent does the work with its
 * ordinary tools (read/write/bash/ask_user_question). The workflow produces:
 *
 *   1. a minimal CLAUDE.md at the project root (Claude Code header included)
 *   2. an AGENTS.md that is a RELATIVE SYMLINK to CLAUDE.md, so AGENTS.md
 *      readers and CLAUDE.md readers share one source of truth
 *
 * The workflow text is adapted from Claude Code's NEW_INIT_PROMPT
 * (interview → explore → gap-fill → write → link → summary), trimmed to what
 * DSH can actually do (no hooks phase) and extended with the AGENTS.md link
 * phase.
 */

export const name = 'dsh-init'

/** `ctx.tools` and `ctx.commands` are Services: declare them before touching them. */
export const inject = ['tools', 'commands']

const TOOL_NAME = 'init'

const COMMAND_DESCRIPTION =
  'Initialize CLAUDE.md and an AGENTS.md symlink for this project (Claude Code style /init)'

const TOOL_DESCRIPTION =
  'Claude Code style /init: initialize the current project\'s agent instruction ' +
  'files. Use when the user asks to run /init, or to (re)initialize the project ' +
  'for Claude Code / DSH / coding agents. Produces a minimal CLAUDE.md and an ' +
  'AGENTS.md symlinked to it, via an interview + codebase-survey workflow.'

const INIT_PROMPT = `Set up a minimal CLAUDE.md (and optionally a personal CLAUDE.local.md) for this repo, then link AGENTS.md to CLAUDE.md as a symlink. CLAUDE.md is loaded into every agent session, so it must be concise — only include what the agent would get wrong without it.

Work on the project in the current working directory. Track progress with the todo tool.

## Phase 1: Ask what to set up

Use the ask_user_question tool:

- "Which instruction files should /init set up?"
  Options: "Project CLAUDE.md" | "Personal CLAUDE.local.md" | "Both project + personal"
  Project: "Team-shared instructions checked into source control — architecture, coding standards, common workflows."
  Personal: "Your private preferences for this project (gitignored, not shared) — your role, sandbox URLs, preferred test data, workflow quirks."

## Phase 2: Explore the codebase

Survey the codebase before writing anything. Read key files: manifest files (package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml, etc.), README, Makefile / build configs, CI config, existing CLAUDE.md, AGENTS.md, .claude/rules/, .cursor/rules or .cursorrules, .github/copilot-instructions.md, .windsurfrules, .clinerules, .mcp.json.

Detect:
- Build, test, and lint commands (especially non-standard ones)
- Languages, frameworks, and package manager
- Project structure (monorepo with workspaces, multi-module, or single project)
- Code style rules that differ from language defaults
- Non-obvious gotchas, required env vars, or workflow quirks
- Formatter configuration (prettier, biome, ruff, black, gofmt, rustfmt, or a unified format script)

Note what you could NOT figure out from code alone — these become Phase 3 questions. Do not re-ask anything the code already answered.

## Phase 3: Fill in the gaps

Use ask_user_question to gather what you still need. Ask only things the code cannot answer: non-obvious commands, gotchas, branch/PR conventions, required env setup, testing quirks, communication preferences. Skip anything already in the README or obvious from manifest files. Do not mark any option as "recommended" — this is about how the team works, not best practices.

## Phase 4: Write CLAUDE.md (if project scope was chosen)

Write a minimal CLAUDE.md at the project root. Every line must pass this test: "Would removing this cause the agent to make mistakes?" If no, cut it.

Include:
- Build/test/lint commands the agent cannot guess (non-standard scripts, flags, sequences)
- Code style rules that DIFFER from language defaults (e.g. "prefer type over interface")
- Testing instructions and quirks (e.g. "run a single test with: pytest -k 'test_name'")
- Repo etiquette (branch naming, PR conventions, commit style)
- Required env vars or setup steps
- Non-obvious gotchas or architectural decisions
- Important parts from existing AI coding tool configs if they exist (AGENTS.md, .cursor/rules, .cursorrules, .github/copilot-instructions.md, .windsurfrules, .clinerules)

Exclude:
- File-by-file structure or component lists (the agent can discover these by reading the codebase)
- Standard language conventions the agent already knows
- Generic advice ("write clean code", "handle errors")
- Long references or fast-changing docs — reference them with the import syntax instead (a line like \`@docs/api-reference.md\`) so content is pulled in on demand without bloating CLAUDE.md
- Commands obvious from manifest files (standard "npm test", "cargo test", "pytest")
- Invented sections like "Common Development Tasks" or "Tips for Development" — only include information expressly found in files you read

Be specific: "Use 2-space indentation in TypeScript" is better than "Format code properly."

Prefix the file with exactly:

\`\`\`
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
\`\`\`

If CLAUDE.md already exists: read it, propose specific changes as diffs, and explain why each change improves it. Do not silently overwrite.

For monorepos / multi-module projects, mention that subdirectory CLAUDE.md files are loaded automatically when the agent works inside those directories, and offer to create them.

## Phase 5: Link AGENTS.md to CLAUDE.md

AGENTS.md must be a RELATIVE SYMLINK to CLAUDE.md so every AGENTS.md-reading agent shares one source of truth with Claude Code. Use a relative target (CLAUDE.md), never an absolute path, so the link survives repo moves and works on other machines.

- If AGENTS.md does not exist: create it with \`ln -s CLAUDE.md AGENTS.md\`.
- If AGENTS.md already exists as a SYMLINK: verify the target resolves to CLAUDE.md (\`readlink AGENTS.md\`); fix it if it points elsewhere, then done.
- If AGENTS.md exists as a REGULAR FILE: diff it against the new CLAUDE.md. Never silently delete user content — use ask_user_question to offer: "Replace AGENTS.md with a symlink to CLAUDE.md" (offer a backup like AGENTS.md.bak first when contents differ) | "Keep AGENTS.md as-is" .

Verify the result with \`ls -l AGENTS.md\` and confirm the link resolves (e.g. \`head -1 AGENTS.md\`).

## Phase 6: Write CLAUDE.local.md (only if personal scope was chosen)

Write a minimal CLAUDE.local.md at the project root with the user's personal preferences gathered in Phase 3, then add \`CLAUDE.local.md\` to the project's .gitignore so it stays private. Keep it short — only what would make the agent's answers noticeably better for this user. If it already exists, propose additions; do not overwrite.

## Phase 7: Summary

Recap what was written and linked — which files exist now and the key points in each. Remind the user these files are a starting point: review and tweak them, and /init can be re-run anytime to re-scan.`

/**
 * Build the user turn that carries the workflow prompt.
 *
 * Prefers the host's `createUserMessage` helper (mints the durable message id);
 * falls back to a hand-built message with a random UUID id when the package is
 * not resolvable, so the plugin stays dependency-free.
 */
async function buildWorkflowTurn(extraFocus) {
  const suffix = extraFocus
    ? `\n\nAdditional focus from the user: ${extraFocus}`
    : ''
  const text = `${INIT_PROMPT}${suffix}`
  try {
    const mod = await import('@deepseek-ai/dsh-llm')
    if (mod && typeof mod.createUserMessage === 'function') {
      return mod.createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      })
    }
  } catch {
    // dsh-llm not resolvable from this install — hand-build the message
  }
  const { randomUUID } = await import('node:crypto')
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

export async function apply(ctx) {
  // ── model Tool face ────────────────────────────────────────────────────
  // The tool takes no arguments, so the definition below is written in the
  // registry-ready (normalized) form directly — no dependency on
  // @deepseek-ai/dsh-tools is required. If the tool ever grows parameters,
  // switch to `defineTool({ parameters: { ... } })` from that package.
  ctx.effect(() =>
    ctx.tools.register({
      name: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      parameters: { type: 'object', properties: {} },
      output: {
        schema: { type: 'string' },
        render(_args, value) {
          return [{ type: 'text', text: value }]
        },
      },
      async execute() {
        return INIT_PROMPT
      },
    }),
  'dsh-init tool lifecycle')

  // ── slash-command face ─────────────────────────────────────────────────
  // DSH command handlers never reach the model, so the handler queues the
  // workflow prompt as the agent's next ordinary user turn (agent.followup),
  // then reports success for the dispatching UI's flow node.
  ctx.effect(() =>
    ctx.commands.register({
      name: 'init',
      description: COMMAND_DESCRIPTION,
      input: { hint: '[additional focus…]' },
      handler: async (invocation) => {
        const turn = await buildWorkflowTurn(invocation.rawInput.trim())
        invocation.agent.followup(turn)
        return {
          kind: 'success',
          text: 'init workflow queued — the agent will interview you, then generate CLAUDE.md and link AGENTS.md to it',
        }
      },
    }),
  'dsh-init command lifecycle')
}
