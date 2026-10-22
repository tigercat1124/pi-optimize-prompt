# Remaining work

Status as of `v0.1.0` (`main` at `5406513`). All 7 planned steps are done. This file lists what is left.

## Open tasks

1. ~~Add the `pi-package` topic to the GitHub repo.~~ **Done:** `pi-package`, `pi`, `pi-coding-agent` topics added via `gh`.
2. ~~Publish to npm (optional).~~ **Done:** published via npm web-auth flow; `pi install npm:pi-optimize-prompt@0.1.0` verified working (shows in `pi list`).
3. ~~Replace the 2 Japanese test inputs in `core.test.ts` (lines 6 and 8) with English, or keep them on purpose.~~ **Done:** replaced with English; tests pass.
4. ~~Try `level` in real use.~~ **Skipped by owner:** `LOW_MAX_CHARS = 60` kept as is.

## Unresolved issues

1. ~~**No formal type check.**~~ **Done:** `tsconfig.json` + dev dependencies on `@earendil-works/pi-coding-agent`, `@types/node`, `typescript`; `npm run typecheck` (`tsc --noEmit`) is clean.
2. ~~**Config loading is untested.**~~ **Done:** `loadConfig` is now exported and takes an optional path; `config.test.ts` covers missing, broken, unknown-level, sanitized, and valid files.
3. **Lint warnings:** ~~non-atomic `writeFileSync` in `saveConfig`~~ (now writes a temp file then `renameSync`), ~~nested ternary in `optimize-auto`~~ (now if/else), ~~`filter().map()` in `rewrite`~~ (now `flatMap`). `.sort()` without comparator in `mentions` is left as is (harmless for strings).
4. **`main` contains a merge commit** (`5406513`). The repo rule "no merge commits" was bypassed by the owner when pushing. Future changes should be rebased or squashed, or the rule will warn again.
5. **`pi install` was verified only up to the `/optimize-level` picker.** npm install path is now verified end to end; `low`/`high` level behavior and English notifications still unchecked in a live session.
6. **Real email addresses remain in other public repos** of `tigercat1124` (confirmed via GitHub API, last-100-commits sample): `***REMOVED***` (`deno`, `devin-config`, `devin-realtime-usage`, `hono-htmx`, `mcp-template`, `react-router-v7`), `***REMOVED***` (`node-pnpm-template`, `notion-line-api`), and hostname `***REMOVED***` in `devin-config`. Rewriting history needs `git filter-repo` and a force push; not done on purpose.
7. **GitHub email privacy settings** (Settings > Emails: "Keep my email addresses private" and "Block command line pushes that expose my email") must be set in the browser. Not confirmed (token lacks `user` scope, so API check is not possible).
8. ~~**Global git identity**~~ **Resolved:** `~/.gitconfig` already uses the personal address `***REMOVED***`; `~/tiger` no longer exists.

## Cleanup

1. ~~Delete `~/.pi/agent/backup/optimize-prompt-202610222149`~~ **Done:** directory no longer exists.

## Ideas

1. ~~`/optimize-undo`~~ **Done in 0.2.0 (unreleased):** restores the editor text the last `/optimize` replaced.
2. ~~`/optimize-preview`~~ **Done in 0.2.0 (unreleased):** shows the rewrite in a notification without changing the editor.
3. ~~Exclude patterns~~ **Done in 0.2.0 (unreleased):** `exclude` regex list in `optimize-prompt.json` skips matching prompts.
4. ~~Cost display~~ **Done in 0.2.0 (unreleased):** `/optimize-stats` shows session request count, tokens, and estimated cost.
5. ~~Cache~~ **Done in 0.2.0 (unreleased):** session-only cache (max 100 entries) reuses the rewrite of an identical prompt.
