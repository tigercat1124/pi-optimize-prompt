# Distributing to pi

"pi" here is the pi coding agent (`@earendil-works/pi-coding-agent`), not a Raspberry Pi.
Source: pi docs `docs/packages.md`.

## How pi packages work

- A package is a normal directory or npm package. `package.json` declares resources under the `pi` key.
- This package: `"pi": { "extensions": ["./index.ts"] }`. Pi loads the `.ts` file directly, no build step.
- Users install with `pi install <source>`. Sources: `npm:<name>@<version>`, `git:github.com/<owner>/<repo>@<tag>`, a git URL, or a local path.
- Versioned npm specs and git tags/commits are pinned.
- Host-provided packages (`@earendil-works/pi-coding-agent`, `pi-ai`, `pi-agent-core`, `pi-tui`, `typebox`) go in `peerDependencies` with `"*"`, never in `dependencies`. This package follows that.

## Option A: git only (fastest)

1. Create an empty GitHub repo `pi-optimize-prompt`.
2. `git remote add origin git@github.com:tigercat1124/pi-optimize-prompt.git`
3. `git push -u origin main`
4. `git tag v0.1.0 && git push origin v0.1.0`
5. Users run: `pi install git:github.com/tigercat1124/pi-optimize-prompt@v0.1.0`

## Option B: npm (adds discovery)

1. `npm login`
2. `npm pack --dry-run` and check that only `index.ts`, `core.ts`, `LICENSE`, `NOTICE`, `README.md` and `package.json` are listed.
3. `npm publish --access public`
4. Users run: `pi install npm:pi-optimize-prompt@0.1.0`
5. The `pi-package` keyword (already set) makes the package eligible for the pi package gallery (https://pi.dev/packages).

Do A first. Add B when you want gallery discovery.

## Before users install

- If you have the same code in `~/.pi/agent/extensions/optimize-prompt/`, remove or disable it first. Otherwise both copies load and register the same commands.
- Add the `repository` field to `package.json` once the repo URL exists.
- A packaged extension runs with full user permissions. Say so in the README if asked; pi docs tell users to review package source before installing.

## Not verified

- `pi install ./pi-optimize-prompt` and `pi -e` were not run, because they change or load your personal pi config.
- Gallery listing rules beyond the `pi-package` keyword were not checked.
