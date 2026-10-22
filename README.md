# pi-optimize-prompt

A [pi](https://github.com/earendil-works/pi-coding-agent) extension that rewrites vague prompts into specific, scoped instructions before they are sent, so the agent gets it right on the first turn.

- Already-specific prompts are returned unchanged.
- Any failure (timeout, error, unsafe rewrite) falls back to your original text.
- `@file` mentions are kept verbatim; a rewrite that changes them is discarded.

## Prerequisites

- pi (`@earendil-works/pi-coding-agent`) with at least one model available.
- Node.js with TypeScript type stripping (Node 24+) to run the tests.

## Privacy and cost

Every prompt that gets optimized is sent to the optimizer model as an extra request. This costs tokens and shares the prompt text with that model's provider. Choose a cheap model with `/optimize-model`, lower the `level`, or turn auto mode off.

An identical prompt optimized again in the same session reuses the previous rewrite instead of a new request. `/optimize-stats` shows the running request and token count.

## Usage

| Action | What it does |
|---|---|
| Submit a prompt | Auto mode (default on) optimizes it first. The original text is shown in a notification. |
| Prefix with `\` | Send the prompt as typed, once. The `\` is removed. |
| `Alt+O` or `/optimize` | Rewrite the editor text so you can review it before sending. Ignores `level`. |
| `/optimize-preview` | Show the rewrite in a notification without changing the editor. |
| `/optimize-undo` | Restore the editor text the last `/optimize` replaced. |
| `/optimize-stats` | Show this session's optimizer request count, tokens, and estimated cost. |
| `/optimize-auto [on\|off]` | Toggle auto mode, or set it explicitly. |
| `/optimize-model` | Pick the optimizer model (default: current session model). |
| `/optimize-level [low\|medium\|high]` | Set how eagerly auto mode runs. Without an argument, opens a picker. |

Slash commands, `!` shell lines and empty input are never optimized.

### Levels

`level` decides which submitted prompts auto mode optimizes. It does not change how a prompt is rewritten.

| level | Optimizes |
|---|---|
| `low` | Short prompts only: 8 to 60 characters. |
| `medium` (default) | Prompts of 8 or more characters. Same as before `level` existed. |
| `high` | Any non-empty prompt, including very short ones like `ok`. |

Length is counted after trimming whitespace. The 60-character cutoff for `low` is fixed (`LOW_MAX_CHARS` in `core.ts`).

## Configuration

File: `~/.pi/agent/optimize-prompt.json`. Written by the commands above; you can also edit it by hand.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `auto` | boolean | `true` | Optimize on submit. |
| `model` | string | current session model | `provider/model-id`. The id may contain `/`. |
| `level` | `"low"` \| `"medium"` \| `"high"` | `"medium"` | See [Levels](#levels). An unknown value falls back to `medium`. |
| `exclude` | string[] | none | Regex patterns; a prompt matching any of them is never auto-optimized. Invalid patterns are ignored. |

A missing or unreadable file uses the defaults.

## Install

```sh
pi install git:github.com/tigercat1124/pi-optimize-prompt@v0.1.0   # from git, pinned to a tag
pi install npm:pi-optimize-prompt@0.1.0                       # from npm
pi install ./pi-optimize-prompt                               # local checkout
```

To try it for one run without installing: `pi -e <source>`. `package.json` declares the entry point in its `pi.extensions` field.

## Development

```sh
npm test
```

Files:

- `core.ts`: pure helpers, no pi imports, unit-tested.
- `index.ts`: pi integration (input hook, commands, config file).
- `core.test.ts`: tests for the helpers.
- `config.test.ts`: tests for `loadConfig`.

### `core.ts` API

| Export | Signature | Purpose |
|---|---|---|
| `classifyInput` | `(text, level = "medium") => "optimize" \| "escape" \| "skip"` | Decide what auto mode does with a submitted prompt. |
| `cleanReply` | `(raw, draft, nonce) => string \| null` | Strip a copied wrapper tag. Returns `null` when the reply is empty or its `@file` mentions differ from the draft. |
| `buildPayload` | `(draft, nonce) => string` | Wrap the draft in a per-request tag so it cannot forge a closing tag. |
| `mentions` | `(s) => string` | Sorted `@path` mentions, used to compare a rewrite with its draft. |
| `matchesAny` | `(text, patterns?) => boolean` | True when `text` matches any regex; invalid patterns are ignored. Used by `exclude`. |
| `parseModelKey` | `(key) => [provider, id]` | Split `provider/model-id`. |
| `isLevel` | `(v) => v is Level` | Validate a level value. |
| `LEVELS`, `DEFAULT_LEVEL`, `LOW_MAX_CHARS`, `MIN_CHARS` | constants | Level names, default (`medium`), `low` upper bound (60), lower bound (8). |
| `SYSTEM` | string | System prompt for the optimizer model. |

## License

Apache-2.0. See `LICENSE`. The system prompt is adapted from [Kiro Crew](https://github.com/kirodotdev/KiroCrew) (Apache-2.0); see `NOTICE`.
