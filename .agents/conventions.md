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

### ESLint Constraints to Watch

- **No `for...of` loops** — use indexed `for` loops instead
- **No shorthand constructor parameter properties** (`private x: string` in constructor params) — declare the field explicitly and assign in constructor body
- **No useless constructors** — if a constructor only assigns parameter properties, declare the field and assign explicitly

## File Organization

- **Port interfaces**: Each domain has its own `types.ts` under `src/core/<domain>/`
- **Adapters**: Real and fake implementations live alongside their port in the same folder
- **Domain types**: `PackageJson` and `Package` live in `src/core/package/types.ts`
- **Orchestration types**: `PublishOptions` lives in `src/types.ts` (references all port interfaces)
- **Constants**: Registry URLs in `src/constants.ts`
- **Utilities**: Small helpers in `src/utils/`
- **Barrel exports**: Each `core/<domain>/` folder has `index.ts`, rolled up to `src/core/index.ts`
- `src/index.ts` re-exports `./core`, `./module`, `./package`, `./package-dependency`, `./types`

### Hexagonal Architecture Rules

- Port interfaces go in `src/core/<domain>/types.ts`
- Every port must have at least one real adapter and one memory/fake adapter
- Adapters import from their own domain's `types.ts` (relative `./types`), not from root `types.ts`
- The CLI (`cli.ts`) is the composition root — it wires real adapters
- `module.ts` provides defaults for adapters not passed in `PublishOptions`
- **Never use `vi.mock`** in tests — inject memory adapters instead

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
