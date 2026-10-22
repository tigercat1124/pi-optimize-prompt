# Remaining work

Status as of `v0.1.0` (`main` at `5406513`). All 7 planned steps are done. This file lists what is left.

## Open tasks

1. Add the `pi-package` topic to the GitHub repo (repo page, gear icon). Done when: the topic shows on the repo page.
2. ~~Publish to npm (optional).~~ **Done:** published via npm web-auth flow; `pi install npm:pi-optimize-prompt@0.1.0` verified working (shows in `pi list`).
3. ~~Replace the 2 Japanese test inputs in `core.test.ts` (lines 6 and 8) with English, or keep them on purpose.~~ **Done:** replaced with English; tests pass.
4. Try `level` in real use. `LOW_MAX_CHARS = 60` in `core.ts` is a guess. Done when: the value is kept or changed based on use.

## Unresolved issues

1. ~~**No formal type check.**~~ **Done:** `tsconfig.json` + dev dependencies on `@earendil-works/pi-coding-agent`, `@types/node`, `typescript`; `npm run typecheck` (`tsc --noEmit`) is clean.
2. ~~**Config loading is untested.**~~ **Done:** `loadConfig` is now exported and takes an optional path; `config.test.ts` covers missing, broken, unknown-level, and valid files.
3. **Lint warnings:** ~~non-atomic `writeFileSync` in `saveConfig`~~ (now writes a temp file then `renameSync`), ~~nested ternary in `optimize-auto`~~ (now if/else), ~~`filter().map()` in `rewrite`~~ (now `flatMap`). `.sort()` without comparator in `mentions` is left as is (harmless for strings).
4. **`main` contains a merge commit** (`5406513`). The repo rule "no merge commits" was bypassed by the owner when pushing. Future changes should be rebased or squashed, or the rule will warn again.
5. **`pi install` was verified only up to the `/optimize-level` picker.** `low` and `high` behavior and the English notifications were not checked in a real session.
6. **Real email addresses remain in other public repos** of `tigercat1124`: `***REMOVED***` (`deno`, `devin-config`, `devin-realtime-usage`, `hono-htmx`, `mcp-template`, `react-router-v7`), `***REMOVED***` (`node-pnpm-template`, `notion-line-api`), and a local hostname in 1 commit of `devin-config`. Rewriting history needs `git filter-repo` and a force push; not done on purpose.
7. **GitHub email privacy settings** (Settings > Emails: "Keep my email addresses private" and "Block command line pushes that expose my email") must be set in the browser. Not confirmed.
8. **Global git identity** in `~/.gitconfig` is still the company address. Only repos under `~/tiger` use the personal one (`~/tiger/.gitconfig`).

## Cleanup

1. ~~Delete `~/.pi/agent/backup/optimize-prompt-202610222149`~~ **Done:** directory no longer exists.

## Ideas (not started)

1. `/optimize-undo`: restore the text before the last rewrite.
2. `/optimize-preview`: show the rewrite without sending.
3. Exclude patterns: skip prompts that match a configured regex.
4. Cost display: count rewrite requests and tokens.
5. Cache: reuse the rewrite of an identical prompt.
