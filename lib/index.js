/**
 * dsh-init — `/init` command for the DeepSeek Harness (DSH), AGENTS.md edition.
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
 *   1. a minimal AGENTS.md at the project root — the open, tool-agnostic
 *      instruction file that DSH, Claude Code, Cursor, Codex, Copilot and the
 *      rest of the ecosystem read. It is the ONLY instruction file generated.
 *   2. optionally a personal AGENTS.local.md (gitignored).
 *
 * The interview also asks which language the agent should REPLY in — answers
 * only, never the reasoning/trace language. A named language becomes a one-line
 * "## Communication" constraint in AGENTS.md; the default ("match my messages")
 * writes nothing, because that is a behaviour agents already default to and a
 * line restating it would be noise in the repo's source of truth.
 *
 * CLAUDE.md is deliberately NOT generated: Claude Code itself reads AGENTS.md
 * now, so the previous "write CLAUDE.md, then symlink AGENTS.md to it"
 * arrangement produced a deprecated file plus a platform-fragile symlink
 * (symlinks need Developer Mode on Windows and `core.symlinks` in git).
 * An existing CLAUDE.md is treated as legacy input: its still-valid content is
 * folded into AGENTS.md, and the file itself is then offered for deletion.
 *
 * The workflow text is adapted from Claude Code's NEW_INIT_PROMPT
 * (interview → explore → gap-fill → write → summary), trimmed to what DSH can
 * actually do (no hooks phase) and re-pointed at AGENTS.md.
 */

export const name = 'dsh-init'

/** `ctx.tools` and `ctx.commands` are Services: declare them before touching them. */
export const inject = ['tools', 'commands']

const TOOL_NAME = 'init'

const COMMAND_DESCRIPTION =
  'Initialize AGENTS.md (and optionally AGENTS.local.md) for this project — interview (scope + reply language) + codebase survey'

const TOOL_DESCRIPTION =
  'Initialize the current project\'s agent instruction file. Use when the user ' +
  'asks to run /init, or to (re)initialize the project for DSH / Claude Code / ' +
  'Cursor / Codex / any AGENTS.md-reading coding agent. Produces a minimal ' +
  'AGENTS.md via an interview + codebase-survey workflow, optionally migrates a ' +
  'legacy CLAUDE.md into it, and can add a personal AGENTS.local.md. The ' +
  'interview also asks which language to REPLY in (answer language only, never ' +
  'reasoning language); a named language is recorded in AGENTS.md, and the ' +
  'default writes nothing.'

const INIT_PROMPT = `Set up a minimal AGENTS.md (and optionally a personal AGENTS.local.md) for this repo. AGENTS.md is the tool-agnostic instruction file that coding agents load into every session — DSH, Claude Code, Cursor, Codex, Copilot and others all read it, so it is the only instruction file this workflow generates. It must be concise: only include what an agent would get wrong without it.

Do NOT create CLAUDE.md. Claude Code itself reads AGENTS.md, and its CLAUDE.md convention is deprecated for new setups — a second file only creates drift.

Work on the project in the current working directory. Track progress with the todo tool.

## Phase 1: Ask what to set up, and which language to reply in

Use the ask_user_question tool ONCE, with BOTH questions:

- "Which instruction files should /init set up?"
  Options: "Project AGENTS.md" | "Personal AGENTS.local.md" | "Both project + personal"
  Project: "Team-shared instructions checked into source control — architecture, coding standards, common workflows."
  Personal: "Your private preferences for this project (gitignored, not shared) — your role, sandbox URLs, preferred test data, workflow quirks."
- "Which language should I reply in? This sets the language of my answers to you, not my internal reasoning."
  Options: "Match my messages (Recommended)" | "简体中文" | "English" | "Other (type it below)"
  Match my messages: "Reply in whatever language I write to you in. Nothing is written into AGENTS.md."
  A named language: "Every reply you write to me uses it; how you think is unaffected."

Apply the language answer from here on to everything you write TO THE USER for the rest of this workflow — your questions, your explanation of each diff, your summary. It does not touch your reasoning, and it does not rename identifiers, paths, commands, URLs, or error text: those stay verbatim.

A named language is a file-worthy fact (Phase 4). "Match my messages" writes nothing, because a file instructing an agent to answer in the user's language states a default the agent already follows.

## Phase 2: Explore the codebase

Survey the codebase before writing anything. Read key files: manifest files (package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml, etc.), README, Makefile / build configs, CI config, an existing AGENTS.md, a legacy CLAUDE.md, .claude/rules/, .cursor/rules or .cursorrules, .github/copilot-instructions.md, .windsurfrules, .clinerules, .mcp.json.

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

## Phase 4: Write AGENTS.md (if project scope was chosen)

Write a minimal AGENTS.md at the project root. Every line must pass this test: "Would removing this cause the agent to make mistakes?" If no, cut it.

Include:
- Build/test/lint commands the agent cannot guess (non-standard scripts, flags, sequences)
- Code style rules that DIFFER from language defaults (e.g. "prefer type over interface")
- Testing instructions and quirks (e.g. "run a single test with: pytest -k 'test_name'")
- Repo etiquette (branch naming, PR conventions, commit style)
- Required env vars or setup steps
- Non-obvious gotchas or architectural decisions
- The reply language from Phase 1, only when it named a specific language (see below)
- Important parts from other AI coding tool configs if they exist (.cursor/rules, .cursorrules, .github/copilot-instructions.md, .windsurfrules, .clinerules)

Exclude:
- File-by-file structure or component lists (the agent can discover these by reading the codebase)
- Standard language conventions the agent already knows
- Generic advice ("write clean code", "handle errors")
- Long references or fast-changing docs — reference them with a link or an \`@docs/api-reference.md\`-style import so content is pulled in on demand without bloating AGENTS.md
- Commands obvious from manifest files (standard "npm test", "cargo test", "pytest")
- Invented sections like "Common Development Tasks" or "Tips for Development" — only include information expressly found in files you read

Be specific: "Use 2-space indentation in TypeScript" is better than "Format code properly."

### Reply language

If Phase 1 named a specific language, add one line under a short "## Communication" heading, and phrase it as a constraint on the ANSWER only:

\`\`\`
## Communication
- Reply in <language>. Reasoning/thinking may use any language; this concerns visible answers, not internal reasoning.
\`\`\`

That second clause is not decoration — state it, because a bare "reply in Chinese" is commonly over-read as a directive about the model's reasoning, and gets silently widened by later agents editing the file. Write it in English even when the target answer language is something else, so the constraint stays legible to every agent that reads AGENTS.md.

Do NOT write a language line at all when Phase 1 chose "Match my messages". Also do NOT record a reasoning/thinking language anywhere in AGENTS.md: reasoning language is a per-session, per-model concern that instruction files do not control, and a line claiming to pin it would be a false statement in the repo's source of truth.

Prefix the file with exactly:

\`\`\`
# AGENTS.md

This file provides guidance to coding agents (DSH, Claude Code, Cursor, Codex, …) when working with code in this repository.
\`\`\`

If AGENTS.md already exists: read it, propose specific changes as diffs, and explain why each change improves it. Do not silently overwrite.

For monorepos / multi-module projects, mention that nested AGENTS.md files are loaded automatically when the agent works inside those directories, and offer to create them.

## Phase 5: Retire a legacy CLAUDE.md (only if one exists)

Skip this phase entirely when the repo has no CLAUDE.md.

A legacy CLAUDE.md is input, not output: fold anything in it that still passes the Phase 4 test into AGENTS.md (do not drop repo-specific knowledge on the floor while migrating), then ask what to do with the file itself. Use ask_user_question:

- "This repo has a CLAUDE.md. What should happen to it now that AGENTS.md carries the instructions?"
  Options: "Delete CLAUDE.md" (recommended — one source of truth) | "Keep CLAUDE.md as-is" | "Replace CLAUDE.md with a pointer to AGENTS.md"

Delete safely: if the existing CLAUDE.md contains content that did not make it into AGENTS.md, back it up as CLAUDE.md.bak before removing it, and say where the backup went. Never delete silently, and never leave a CLAUDE.md that contradicts AGENTS.md.

## Phase 6: Write AGENTS.local.md (only if personal scope was chosen)

Write a minimal AGENTS.local.md at the project root with the user's personal preferences gathered in Phase 3, then add \`AGENTS.local.md\` to the project's .gitignore so it stays private. Keep it short — only what would make the agent's answers noticeably better for this user. If it already exists, propose additions; do not overwrite.

## Phase 7: Summary

Recap what was written — which files exist now and the key points in each. Say explicitly whether a legacy CLAUDE.md was migrated, deleted, or left alone, and what happened to the reply-language answer: recorded in AGENTS.md, or deliberately not recorded because "Match my messages" was chosen. Remind the user these files are a starting point: review and tweak them, and /init can be re-run anytime to re-scan.`

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
          text: 'init workflow queued — the agent will interview you (scope + reply language), then generate AGENTS.md (a legacy CLAUDE.md is migrated and offered for deletion)',
        }
      },
    }),
  'dsh-init command lifecycle')
}
