# Conventions

## Tooling

| Tool           | Purpose                                      |
|----------------|----------------------------------------------|
| **Rollup**     | Module bundler (ESM output)                  |
| **SWC**        | TypeScript compilation (via @rollup/plugin-swc) |
| **TypeScript** | Type checking (`tsc --emitDeclarationOnly`)  |
| **Vitest**     | Test runner                                  |
| **ESLint**     | Linting (`@tada5hi/eslint-config-typescript`) |
| **Husky**      | Git hooks                                    |
| **commitlint** | Conventional commit message enforcement      |

## Code Style

- **Module format**: ESM (`"type": "module"` in package.json)
- **Indentation**: 4 spaces
- **Line endings**: LF
- **Charset**: UTF-8
- **Final newline**: Always present

ESLint extends `@tada5hi/eslint-config-typescript`. Key overrides:
- `class-methods-use-this` — disabled
- `no-shadow` — disabled
- `no-use-before-define` — disabled

## File Organization

- **Types**: Shared type definitions live in `src/types.ts`
- **Constants**: Registry URLs and other constants in `src/constants.ts`
- **Utilities**: Small helper functions in `src/utils/`
- **Barrel exports**: `src/index.ts` re-exports the public API
- Each source file focuses on a single responsibility

## Commit Convention

Commits follow **Conventional Commits** via `@tada5hi/commitlint-config`:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `chore`, `build`, `ci`, `docs`, `refactor`, `test`

The commit-msg hook enforces this via Husky + commitlint.

## Build Output

- Library: `dist/index.mjs` (ESM) + `dist/index.d.ts` (types)
- CLI: `dist/cli.mjs` (ESM with shebang `#!/usr/bin/env node`) + `dist/cli.cjs` (CommonJS)
- The `bin` field in package.json points to `dist/cli.mjs`
- All dependencies are externalized in Rollup — only project code is bundled

## Workflow Rules

1. **Always build before linting** — ESLint may depend on generated type declarations
2. **Run tests after changes** — `npm run test` before committing
3. **Do not modify `dist/`** — it is generated; changes will be overwritten
4. **Keep `package-lock.json` in sync** — use `npm ci` for clean installs

## Release Process

Releases are automated via **release-please**:

1. Push to `master` triggers the release workflow
2. release-please opens/updates a release PR with changelog and version bump
3. Merging the release PR triggers:
   - npm package publishing via `node ./dist/cli.mjs`
   - GitHub release creation
4. Configuration is in `release-please-config.json`

## CI/CD

- **CI** (`.github/workflows/main.yml`): Runs on push to main branches and PRs. Jobs: install → build → lint + test (parallel).
- **Release** (`.github/workflows/release.yml`): Runs on push to `master` only. Uses release-please + self-publishing (the tool publishes itself).

## Dependencies

- Prefer well-maintained, focused packages over large frameworks
- Production deps should be minimal — this is a CLI tool
- Dev deps use shared `@tada5hi/*` configurations for consistency across projects
