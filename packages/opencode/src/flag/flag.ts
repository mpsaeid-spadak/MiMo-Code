import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function nonNegativeNumber(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

// A fraction in (0, 1], written either as a decimal ("0.85") or a percentage
// ("85%"). Values outside the range — and anything unparseable — yield undefined
// so the caller keeps its own default.
function ratio(key: string) {
  const value = process.env[key]?.trim()
  if (!value) return undefined
  const parsed = value.endsWith("%") ? Number(value.slice(0, -1)) / 100 : Number(value)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : undefined
}

const SPADAKCODE_EXPERIMENTAL = truthy("SPADAKCODE_EXPERIMENTAL")

// Defaults to false. When enabled, spadakcode runs in pure-spadak mode:
//   — does NOT inherit Claude Code prompt files (CLAUDE.md, ~/.claude/CLAUDE.md)
//   — does NOT pick up provider API keys from environment variables
//   — falls back to the spadak-auto model as the default
// Set SPADAKCODE_SPADAK_ONLY=true to disable .claude inheritance and env-based
// provider auto-detection.
const SPADAKCODE_SPADAK_ONLY = truthy("SPADAKCODE_SPADAK_ONLY")
const SPADAKCODE_DISABLE_CLAUDE_CODE_ENV = truthy("SPADAKCODE_DISABLE_CLAUDE_CODE")
const SPADAKCODE_DISABLE_CLAUDE_CODE = SPADAKCODE_SPADAK_ONLY || SPADAKCODE_DISABLE_CLAUDE_CODE_ENV

// External skill roots:
//   .agents                       default on  — SPADAKCODE_DISABLE_AGENTS_SKILLS
//   .claude / .codex / .opencode  default off — SPADAKCODE_ENABLE_*_SKILLS
const copy = process.env["SPADAKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

/**
 * Password for a listener nobody asked for, held in memory only.
 *
 * Opening a socket makes every instance route reachable by any process running as
 * this user — `/file` reads and writes the project, `/pty` and `/bash-interactive`
 * run commands. The token-authenticated `/v1` routes are carved out of basic auth on
 * purpose (see `server/middleware.ts`), so generating this closes everything else
 * without closing the surface the listener exists for.
 */
let generatedServerPassword: string | undefined

/**
 * Generate the password for an implicit listener, once.
 *
 * Idempotent: a second listener in the same process must not invalidate the
 * credential the first one is already authenticating against. A user-supplied
 * password always wins, and in that case nothing is generated at all — the operator
 * has already said what auth should be.
 */
export function generateServerPassword() {
  if (process.env["SPADAKCODE_SERVER_PASSWORD"]) return
  generatedServerPassword ??= Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
}

/**
 * Disarm the generated password once its listener is gone.
 *
 * A credential outliving the socket it was minted for is state with no owner: nothing can
 * present it any more, but every in-process request still has to satisfy it. Clearing it
 * belongs with `stop()` for the same reason unpublishing the address does.
 */
export function clearGeneratedServerPassword() {
  generatedServerPassword = undefined
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  SPADAKCODE_AUTO_SHARE: truthy("SPADAKCODE_AUTO_SHARE"),
  SPADAKCODE_AUTO_HEAP_SNAPSHOT: truthy("SPADAKCODE_AUTO_HEAP_SNAPSHOT"),
  SPADAKCODE_GIT_BASH_PATH: process.env["SPADAKCODE_GIT_BASH_PATH"],
  SPADAKCODE_CONFIG: process.env["SPADAKCODE_CONFIG"],
  SPADAKCODE_CONFIG_CONTENT: process.env["SPADAKCODE_CONFIG_CONTENT"],

  SPADAKCODE_DISABLE_AUTOUPDATE: truthy("SPADAKCODE_DISABLE_AUTOUPDATE"),

  // Defaults to false (rotation enabled). When enabled, the active log file is
  // never archived to <name>.log.<stamp> on hitting MAX_FILE_SIZE — it grows in
  // place. Useful when an external tool tails/manages the single log file.
  SPADAKCODE_DISABLE_LOG_ROTATION: truthy("SPADAKCODE_DISABLE_LOG_ROTATION"),

  // Defaults to true (analytics enabled). Set SPADAKCODE_ENABLE_ANALYSIS=false
  // to opt out of POSTing model_call/tool_call/agent_request metrics.
  SPADAKCODE_ENABLE_ANALYSIS: !falsy("SPADAKCODE_ENABLE_ANALYSIS"),
  SPADAKCODE_ALWAYS_NOTIFY_UPDATE: truthy("SPADAKCODE_ALWAYS_NOTIFY_UPDATE"),
  SPADAKCODE_DISABLE_PRUNE: truthy("SPADAKCODE_DISABLE_PRUNE"),
  SPADAKCODE_DISABLE_TERMINAL_TITLE: truthy("SPADAKCODE_DISABLE_TERMINAL_TITLE"),
  SPADAKCODE_SHOW_TTFD: truthy("SPADAKCODE_SHOW_TTFD"),
  SPADAKCODE_PERMISSION: process.env["SPADAKCODE_PERMISSION"],

  // Defaults to false. When false, the bash tool intercepts irreversible
  // deletion commands (rm, rmdir, unlink, shred, del, erase, rd, remove-item,
  // and git destructive subcommands like reset --hard / clean -f / branch -D /
  // worktree remove / push --force / stash drop|clear / tag -d) and forces an
  // extra permission prompt with permission="bash_delete" — separate from the
  // normal bash-permission ask so it can't be silently pre-approved by a broad
  // `bash: allow` rule. Set SPADAKCODE_AUTO_APPROVE_DELETE=true to trust the
  // model with deletes and skip the second confirmation.
  // Read lazily (getter, not an eagerly-evaluated literal) so an embedder can
  // flip it at runtime: the desktop app runs the server in-process, so its
  // approval mode — switchable mid-session, like the TUI's /skip-permissions —
  // has no process boundary at which to re-read env. A literal would freeze
  // this at module-evaluation time and make every later write a no-op.
  get SPADAKCODE_AUTO_APPROVE_DELETE() {
    return truthy("SPADAKCODE_AUTO_APPROVE_DELETE")
  },
  // Set by the TUI's --dangerously-skip-permissions flag. When truthy, an
  // allow-all base ruleset is injected UNDER the user's config permission so
  // every tool auto-approves unless the user explicitly denied it.
  SPADAKCODE_DANGEROUSLY_SKIP_PERMISSIONS: truthy("SPADAKCODE_DANGEROUSLY_SKIP_PERMISSIONS"),
  SPADAKCODE_DISABLE_DEFAULT_PLUGINS: truthy("SPADAKCODE_DISABLE_DEFAULT_PLUGINS"),
  SPADAKCODE_DISABLE_LSP_DOWNLOAD: truthy("SPADAKCODE_DISABLE_LSP_DOWNLOAD"),
  SPADAKCODE_ENABLE_EXPERIMENTAL_MODELS: truthy("SPADAKCODE_ENABLE_EXPERIMENTAL_MODELS"),
  // Defaults to false. When enabled, checkpoint writers, checkpoint-based
  // context rebuilds, and checkpoint copy in the system prompt and tool
  // schemas are disabled; context overflow falls back to compaction.
  // Read lazily so tests and in-process embedders can toggle it at runtime.
  get SPADAKCODE_DISABLE_CHECKPOINT() {
    return truthy("SPADAKCODE_DISABLE_CHECKPOINT")
  },
  SPADAKCODE_DISABLE_AUTOCOMPACT: truthy("SPADAKCODE_DISABLE_AUTOCOMPACT"),
  // Default compaction trigger, used when `compaction.max_context` is not set in
  // config. Same grammar as that config field: an absolute token count
  // ("300000"), a shorthand ("300K", "1M"), or a percentage of the model window
  // ("50%"). Clamped to the model window — it can only lower the trigger, never
  // raise it. An explicit `compaction.max_context` in config overrides this.
  // Pairs with SPADAKCODE_DISABLE_CHECKPOINT: on the checkpoint-off fallback path
  // this is how the compaction threshold is tuned via env alone. Read lazily so
  // tests and in-process embedders can toggle it at runtime.
  get SPADAKCODE_COMPACTION_MAX_CONTEXT() {
    return process.env["SPADAKCODE_COMPACTION_MAX_CONTEXT"]
  },
  // Fraction of the working window at which compaction fires; the remaining
  // headroom is what the summary generation gets to write into. Accepts a decimal
  // ("0.85") or a percentage ("85%"); anything unparseable or outside (0, 1] is
  // ignored and the 0.9 default stands. Applies on top of whatever window
  // `compaction.max_context` / SPADAKCODE_COMPACTION_MAX_CONTEXT resolved to, so
  // the two compose rather than override each other. Read lazily so tests and
  // in-process embedders can toggle it at runtime.
  get SPADAKCODE_COMPACTION_TRIGGER_RATIO() {
    return ratio("SPADAKCODE_COMPACTION_TRIGGER_RATIO") ?? 0.9
  },
  SPADAKCODE_DISABLE_MODELS_FETCH: truthy("SPADAKCODE_DISABLE_MODELS_FETCH"),
  // Defaults to automatic model inference. Explicit true forces every model to
  // use the GPT system prompt and Codex toolset; explicit false forces even GPT
  // models to use the default prompt and toolset.
  get SPADAKCODE_CODEX_MODE() {
    if (truthy("SPADAKCODE_CODEX_MODE")) return true
    if (falsy("SPADAKCODE_CODEX_MODE")) return false
    return undefined
  },
  SPADAKCODE_DISABLE_MOUSE: truthy("SPADAKCODE_DISABLE_MOUSE"),
  SPADAKCODE_OUTPUT_LENGTH_CONTINUATION_LIMIT: number("SPADAKCODE_OUTPUT_LENGTH_CONTINUATION_LIMIT") ?? 3,
  SPADAKCODE_INVALID_OUTPUT_CONTINUATION_LIMIT: number("SPADAKCODE_INVALID_OUTPUT_CONTINUATION_LIMIT") ?? 2,
  SPADAKCODE_TEXT_TOOL_CALL_RETRY_LIMIT: number("SPADAKCODE_TEXT_TOOL_CALL_RETRY_LIMIT") ?? 2,
  // Defaults to false. When enabled, unsigned historical reasoning sent through
  // the Anthropic Messages format receives an empty placeholder signature so it
  // follows the same native thinking-block serialization path as signed content.
  get SPADAKCODE_FORCE_ANTHROPIC_REASONING_CONTENT() {
    return truthy("SPADAKCODE_FORCE_ANTHROPIC_REASONING_CONTENT")
  },

  // Consecutive-block repetition detection for streamed reasoning + text.
  // A block of at least N tokens repeating REPEAT_THRESHOLD times consecutively
  // within the last WINDOW_TOKENS tokens triggers recovery (remind → replan → terminate).
  SPADAKCODE_TEXT_NGRAM_N: number("SPADAKCODE_TEXT_NGRAM_N") ?? 4,
  SPADAKCODE_TEXT_REPEAT_THRESHOLD: number("SPADAKCODE_TEXT_REPEAT_THRESHOLD") ?? 20,
  SPADAKCODE_TEXT_WINDOW_TOKENS: number("SPADAKCODE_TEXT_WINDOW_TOKENS") ?? 500,

  // Caps applied to image attachments before a prompt is sent.
  // SPADAKCODE_MAX_PROMPT_IMAGES (default undefined = no count limit) bounds how
  // many images may be sent per request (oldest excess images are dropped).
  // SPADAKCODE_MAX_PROMPT_IMAGE_SIZE overrides the default per-image byte cap
  // (DEFAULT_MAX_IMAGE_BYTES ~4.5 MB, kept under the provider 5 MB hard limit);
  // oversized images are recompressed under the cap, or stripped to a text
  // placeholder when they can't be compressed. Values must be positive integers.
  SPADAKCODE_MAX_PROMPT_IMAGES: number("SPADAKCODE_MAX_PROMPT_IMAGES"),
  SPADAKCODE_MAX_PROMPT_IMAGE_SIZE: number("SPADAKCODE_MAX_PROMPT_IMAGE_SIZE"),
  // Upper bound, in bytes, on a single inline attachment (image, PDF, audio,
  // MCP blob). Enforced where the attachment is produced — the read tool, user
  // prompt attachments, and MCP result normalization — with the size taken
  // from stat or the base64 length so an under-limit payload costs nothing
  // extra. Over the limit, an image is read and recompressed to fit; anything
  // that still cannot fit (PDFs, audio, video, undecodable images) is replaced
  // by a notice, so nothing oversized ever becomes a stored part. Defaults to
  // 50 MB. Provider limits are lower (the Claude API takes 10 MB per image,
  // Bedrock and Vertex 5 MB) and are still enforced at send time by the
  // SPADAKCODE_MAX_PROMPT_IMAGE_SIZE / provider cap in provider/transform.ts.
  // Read lazily so tests can flip it at runtime.
  get SPADAKCODE_MAX_ATTACHMENT_SIZE() {
    return number("SPADAKCODE_MAX_ATTACHMENT_SIZE") ?? 50 * 1024 * 1024
  },
  // Ceiling, in bytes, above which an oversized image is refused outright
  // instead of being read and recompressed. Defaults to 150 MB: compressImage
  // already refuses anything over MAX_DECODE_IMAGE_PIXELS (64 MP), and a PNG
  // that decodes within that budget is at most ~150-200 MB on disk, so a
  // larger file would only be read into memory to fail the pixel guard.
  // Read lazily so tests can flip it at runtime.
  get SPADAKCODE_MAX_ATTACHMENT_SOURCE_SIZE() {
    return number("SPADAKCODE_MAX_ATTACHMENT_SOURCE_SIZE") ?? 150 * 1024 * 1024
  },
  SPADAKCODE_SPADAK_ONLY,
  SPADAKCODE_DISABLE_PROVIDER_ENV: SPADAKCODE_SPADAK_ONLY || truthy("SPADAKCODE_DISABLE_PROVIDER_ENV"),
  SPADAKCODE_DISABLE_CLAUDE_CODE,
  get SPADAKCODE_DISABLE_CLAUDE_CODE_MCP() {
    // MCP compatibility stays on in spadak-only mode so users can reuse Claude Code
    // MCP servers without inheriting prompts or provider env keys.
    return SPADAKCODE_DISABLE_CLAUDE_CODE_ENV || truthy("SPADAKCODE_DISABLE_CLAUDE_CODE_MCP")
  },
  SPADAKCODE_DISABLE_CLAUDE_CODE_PROMPT: SPADAKCODE_DISABLE_CLAUDE_CODE || truthy("SPADAKCODE_DISABLE_CLAUDE_CODE_PROMPT"),
  // Defaults to false (enabled): markdown commands under ~/.claude/commands and
  // {project}/.claude/commands load as slash commands. Independent of the
  // spadak-only master switch. Set SPADAKCODE_DISABLE_CLAUDE_CODE_COMMANDS=true to disable.
  SPADAKCODE_DISABLE_CLAUDE_CODE_COMMANDS: truthy("SPADAKCODE_DISABLE_CLAUDE_CODE_COMMANDS"),
  // External skill-root switches. Read lazily so tests can flip env.
  get SPADAKCODE_DISABLE_AGENTS_SKILLS() {
    return truthy("SPADAKCODE_DISABLE_AGENTS_SKILLS")
  },
  get SPADAKCODE_ENABLE_CLAUDE_CODE_SKILLS() {
    return truthy("SPADAKCODE_ENABLE_CLAUDE_CODE_SKILLS")
  },
  get SPADAKCODE_ENABLE_CODEX_SKILLS() {
    return truthy("SPADAKCODE_ENABLE_CODEX_SKILLS")
  },
  get SPADAKCODE_ENABLE_OPENCODE_SKILLS() {
    return truthy("SPADAKCODE_ENABLE_OPENCODE_SKILLS")
  },

  // Skill-search ranking and loading policy. Exact mentions stay above BM25;
  // the BM25/coverage blend has a 0.90 ceiling, and near-max results auto-load.
  SPADAKCODE_SKILL_SEARCH_EXACT_SCORE: 1,
  SPADAKCODE_SKILL_SEARCH_BM25_K1: 1.5,
  SPADAKCODE_SKILL_SEARCH_BM25_LENGTH_NORMALIZATION: 0.75,
  SPADAKCODE_SKILL_SEARCH_BM25_IDF_SMOOTHING: 0.5,
  SPADAKCODE_SKILL_SEARCH_BM25_SCORE_WEIGHT: 0.55,
  SPADAKCODE_SKILL_SEARCH_QUERY_COVERAGE_WEIGHT: 0.35,
  SPADAKCODE_SKILL_SEARCH_AUTO_LOAD_THRESHOLD: 0.85,
  SPADAKCODE_SKILL_SEARCH_SCORE_PRECISION: 4,
  SPADAKCODE_SKILL_SEARCH_MAX_RESULTS: 3,
  SPADAKCODE_SKILL_SEARCH_STEM_MIN_LENGTH: 3,
  SPADAKCODE_SKILL_SEARCH_FILE_SAMPLE_LIMIT: 10,

  // Defaults to false. When enabled, skill-source commands appear in the `/`
  // autocomplete dropdown alongside user commands and MCP prompts. Skills are
  // surfaced in `/` completion by default; set SPADAKCODE_DISABLE_SLASH_SKILLS=1
  // to hide them and fall back to the `/skills` picker + model-driven
  // invocation only.
  SPADAKCODE_DISABLE_SLASH_SKILLS: truthy("SPADAKCODE_DISABLE_SLASH_SKILLS"),
  SPADAKCODE_FAKE_VCS: process.env["SPADAKCODE_FAKE_VCS"],

  // When enabled, skips all git subprocess calls during project discovery
  // (which git, rev-parse --git-common-dir, rev-parse --show-toplevel) and
  // branch detection. The project is treated as a non-git directory rooted at
  // the working directory. Use to avoid touching git in restricted/sandboxed
  // environments or where git startup probing is undesirable.
  SPADAKCODE_DISABLE_GIT: truthy("SPADAKCODE_DISABLE_GIT"),

  /**
   * The password every non-`/v1` route is authenticated against.
   *
   * A getter rather than a snapshot, because a listener the user did not ask for
   * generates one at bind time (see `generateServerPassword`). The generated value
   * is deliberately NOT written to `process.env`: every child we spawn inherits the
   * environment, and a subprocess is supposed to hold a scoped task token, never the
   * credential that opens the whole instance API.
   */
  get SPADAKCODE_SERVER_PASSWORD() {
    return process.env["SPADAKCODE_SERVER_PASSWORD"] || generatedServerPassword
  },
  /**
   * Did the OPERATOR configure auth, as opposed to us generating a password for a
   * listener we opened on our own initiative?
   *
   * The difference is load-bearing for `InstanceMiddleware`: a user-secured server is
   * allowed to serve directories outside its cwd (the desktop engine does exactly
   * that), while an implicit listener must stay pinned to one project no matter what
   * credential guards it.
   */
  get SPADAKCODE_SERVER_PASSWORD_SUPPLIED() {
    return Boolean(process.env["SPADAKCODE_SERVER_PASSWORD"])
  },
  SPADAKCODE_SERVER_USERNAME: process.env["SPADAKCODE_SERVER_USERNAME"],
  SPADAKCODE_ENABLE_QUESTION_TOOL: truthy("SPADAKCODE_ENABLE_QUESTION_TOOL"),

  // Defaults to false. Set SPADAKCODE_ENABLE_TRY_BEST_HANDOFF=true (or 1) to
  // enable try-best loop detection, automatic turn pausing, and handoff UI.
  SPADAKCODE_ENABLE_TRY_BEST_HANDOFF: truthy("SPADAKCODE_ENABLE_TRY_BEST_HANDOFF"),

  // Defaults to false. Opt in to append the runtime-derived environment block
  // (working directory, platform, shell, git status/branch/commits) to the model's
  // system prompt. Instruction files (AGENTS.md / CLAUDE.md) are appended
  // regardless — suppress the whole block with SPADAKCODE_DISABLE_INSTRUCTIONS, or
  // individual sources with SPADAKCODE_DISABLE_PROJECT_CONFIG /
  // SPADAKCODE_DISABLE_CLAUDE_CODE_PROMPT.
  get SPADAKCODE_ENABLE_DYNAMIC_SYSTEM_PROMPT() {
    return truthy("SPADAKCODE_ENABLE_DYNAMIC_SYSTEM_PROMPT")
  },

  // Defaults to false (enabled): instruction-file content (AGENTS.md / CLAUDE.md)
  // is appended to the model's system prompt. Set SPADAKCODE_DISABLE_INSTRUCTIONS=true
  // to drop the whole instruction block regardless of which files resolve.
  get SPADAKCODE_DISABLE_INSTRUCTIONS() {
    return truthy("SPADAKCODE_DISABLE_INSTRUCTIONS")
  },

  // Defaults to false. The edit tool does pure exact-string matching with
  // explicit error signals. Set SPADAKCODE_ENABLE_FUZZY_EDIT=true to opt into the
  // legacy multi-stage fuzzy fallback chain (line-trimmed / block-anchor /
  // whitespace-normalized / indentation-flexible / etc.) when old_string fails
  // to match exactly.
  SPADAKCODE_ENABLE_FUZZY_EDIT: truthy("SPADAKCODE_ENABLE_FUZZY_EDIT"),

  // Experimental
  SPADAKCODE_EXPERIMENTAL,
  SPADAKCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("SPADAKCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  SPADAKCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("SPADAKCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  SPADAKCODE_EXPERIMENTAL_ICON_DISCOVERY: SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_ICON_DISCOVERY"),
  SPADAKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("SPADAKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  SPADAKCODE_ENABLE_EXA: truthy("SPADAKCODE_ENABLE_EXA") || SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_EXA"),
  SPADAKCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("SPADAKCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  // Token-efficient post-cleanse: strip ANSI / fold \r progress bars / redact
  // secrets / elide super-long lines from bash tool output before it is
  // returned to the model. Only applies when the output fits inline — if the
  // output spills to a truncation file, cleaning is skipped so the on-disk
  // archive stays raw. Off by default. Set to 1/true to opt in.
  SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY: truthy("SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY"),
  // Tunables for the token-efficient post-cleanse pipeline (see
  // src/tool/bash_token_efficient_pipeline.ts). Positive integers only;
  // unset / non-positive values fall back to the documented defaults.
  //   MAX_LINE_CHARS   threshold above which a single line is elided  (default 500)
  //   LINE_HEAD_KEEP   chars kept from the head of an elided line     (default 160)
  //   NEVER_WORSE_MARGIN  bytes the cleaned output must beat the raw  (default 0)
  SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_MAX_LINE_CHARS: number("SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_MAX_LINE_CHARS") ?? 500,
  SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_LINE_HEAD_KEEP: number("SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_LINE_HEAD_KEEP") ?? 160,
  SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_NEVER_WORSE_MARGIN: number("SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_NEVER_WORSE_MARGIN") ?? 0,
  // Heuristic (shape-based) filter pipeline for bash output. Runs AFTER the
  // common pipeline, only when the common pipeline is enabled AND this flag is
  // explicitly opted in. Each shape (gitdiff / pytest / npm / make /
  // stacktrace / tsc / kubectl / json / md / gostest) recognises a command
  // pattern or body fingerprint and rewrites the body to strip predictable
  // noise. Off by default. Set to 1/true to opt in.
  SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_HEURISTIC: truthy("SPADAKCODE_EXPERIMENTAL_TOKEN_EFFICIENCY_HEURISTIC"),
  SPADAKCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("SPADAKCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  SPADAKCODE_EXPERIMENTAL_OXFMT: SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_OXFMT"),
  SPADAKCODE_EXPERIMENTAL_LSP_TY: truthy("SPADAKCODE_EXPERIMENTAL_LSP_TY"),
  SPADAKCODE_EXPERIMENTAL_LSP_TOOL: SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_LSP_TOOL"),
  // Defaults to OFF: exec (tool_script orchestration) is registered only for
  // GPT-toolset models. Opt in here to expose it to every model.
  SPADAKCODE_ENABLE_EXEC_TOOL: truthy("SPADAKCODE_ENABLE_EXEC_TOOL"),
  // Defaults to OFF for non-GPT models. GPT models enable MCP Tool Search in
  // SessionPrompt regardless of this flag. Opt in here to enable it for every
  // function-calling model.
  SPADAKCODE_EXPERIMENTAL_MCP_TOOL_SEARCH:
    SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_MCP_TOOL_SEARCH"),
  // Defaults to OFF (opt-in): the Orchestrator primary mode — a general
  // coordinator that delegates to child sessions via the `session` tool, with a
  // global singleton workspace and child permission-approval routing. Enable with
  // SPADAKCODE_EXPERIMENTAL_ORCHESTRATOR=true (or the umbrella SPADAKCODE_EXPERIMENTAL).
  SPADAKCODE_EXPERIMENTAL_ORCHESTRATOR: SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_ORCHESTRATOR"),
  // Defaults to OFF (opt-in): dynamic workflows and built-in workflows.
  // Enable with SPADAKCODE_EXPERIMENTAL_WORKFLOW_TOOL=true (or the umbrella
  // SPADAKCODE_EXPERIMENTAL flag).
  SPADAKCODE_EXPERIMENTAL_WORKFLOW_TOOL:
    SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_WORKFLOW_TOOL"),
  // Defaults to true: cron + self-paced loop scheduling are on by default.
  // Set SPADAKCODE_EXPERIMENTAL_CRON=false to opt out. Runtime kill switch is
  // SPADAKCODE_DISABLE_CRON (checked live every tick).
  SPADAKCODE_EXPERIMENTAL_CRON: !falsy("SPADAKCODE_EXPERIMENTAL_CRON"),
  // Keepalive contract for self-paced loops (spec [S8]). Budget = how many
  // "forget" turns the model gets before the loop is declared model_stopped;
  // delay seconds = the auto-arm horizon used for the keepalive fire. Budget
  // accepts 0 (end immediately on the first turn without a re-arm) for tests
  // and aggressive policies. Both are getters so tests can flip the env var
  // between cases without restarting the process.
  get SPADAKCODE_LOOP_KEEPALIVE_BUDGET() {
    return nonNegativeNumber("SPADAKCODE_LOOP_KEEPALIVE_BUDGET") ?? 1
  },
  get SPADAKCODE_LOOP_KEEPALIVE_DELAY_S() {
    return number("SPADAKCODE_LOOP_KEEPALIVE_DELAY_S") ?? 1200
  },
  SPADAKCODE_EXPERIMENTAL_MARKDOWN: !falsy("SPADAKCODE_EXPERIMENTAL_MARKDOWN"),
  SPADAKCODE_MODELS_URL: process.env["SPADAKCODE_MODELS_URL"],
  SPADAKCODE_MODELS_PATH: process.env["SPADAKCODE_MODELS_PATH"],
  SPADAKCODE_DISABLE_EMBEDDED_WEB_UI: truthy("SPADAKCODE_DISABLE_EMBEDDED_WEB_UI"),
  SPADAKCODE_DB: process.env["SPADAKCODE_DB"],

  // Defaults to true — all channels share a single spadakcode.db. The per-channel
  // DB isolation (spadakcode-{channel}.db) is unnecessary for spadakcode since we
  // don't ship multiple release channels yet. Use SPADAKCODE_HOME to isolate dev
  // environments instead. Set SPADAKCODE_DISABLE_CHANNEL_DB=false to restore
  // per-channel isolation.
  SPADAKCODE_DISABLE_CHANNEL_DB: !falsy("SPADAKCODE_DISABLE_CHANNEL_DB"),
  SPADAKCODE_SKIP_MIGRATIONS: truthy("SPADAKCODE_SKIP_MIGRATIONS"),
  SPADAKCODE_STRICT_CONFIG_DEPS: truthy("SPADAKCODE_STRICT_CONFIG_DEPS"),

  SPADAKCODE_WORKSPACE_ID: process.env["SPADAKCODE_WORKSPACE_ID"],
  SPADAKCODE_EXPERIMENTAL_HTTPAPI: truthy("SPADAKCODE_EXPERIMENTAL_HTTPAPI"),
  SPADAKCODE_EXPERIMENTAL_WORKSPACES: SPADAKCODE_EXPERIMENTAL || truthy("SPADAKCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.

  // Disables compose-agent-internal skills (e.g. compose:plan, compose:review,
  // compose:tdd). These are hidden workflow-orchestration skills only visible
  // to the compose agent and are NOT part of builtin skills.
  get SPADAKCODE_DISABLE_COMPOSE_SKILLS() {
    return truthy("SPADAKCODE_DISABLE_COMPOSE_SKILLS")
  },
  // Disables user-facing builtin skills shipped with the binary (e.g.
  // evolve). Does not affect compose skills — the two sets are
  // independent and non-overlapping.
  get SPADAKCODE_DISABLE_BUILTIN_SKILLS() {
    return truthy("SPADAKCODE_DISABLE_BUILTIN_SKILLS")
  },
  // Disables the built-in official skills (docx, pdf, pptx, xlsx,
  // html-to-video-pipeline) while keeping the rest of the builtin bundle
  // available. Defaults to false (all skills are extracted and loaded). Set
  // SPADAKCODE_DISABLE_OFFICIAL_SKILLS=true to skip them.
  get SPADAKCODE_DISABLE_OFFICIAL_SKILLS() {
    return truthy("SPADAKCODE_DISABLE_OFFICIAL_SKILLS")
  },
  get SPADAKCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("SPADAKCODE_DISABLE_PROJECT_CONFIG")
  },
  get SPADAKCODE_TUI_CONFIG() {
    return process.env["SPADAKCODE_TUI_CONFIG"]
  },
  get SPADAKCODE_CONFIG_DIR() {
    return process.env["SPADAKCODE_CONFIG_DIR"]
  },
  get SPADAKCODE_HOME() {
    return process.env["SPADAKCODE_HOME"]
  },
  get SPADAKCODE_PURE() {
    return truthy("SPADAKCODE_PURE")
  },
  get SPADAKCODE_PLUGIN_META_FILE() {
    return process.env["SPADAKCODE_PLUGIN_META_FILE"]
  },
  get SPADAKCODE_CLIENT() {
    return process.env["SPADAKCODE_CLIENT"] ?? "cli"
  },
}
