# Project Structure

workspaces-publish is a single-package repository (not a monorepo itself), but it is a tool designed to publish monorepo workspaces.

## Directory Layout

```
workspaces-publish/
├── src/                        # TypeScript source
│   ├── cli.ts                  # CLI entry point (cac-based)
│   ├── index.ts                # Library entry point (public API exports)
│   ├── module.ts               # Core publish() orchestration function
│   ├── package.ts              # Single-package publish logic
│   ├── package-json.ts         # package.json file read/write helpers
│   ├── package-dependency.ts   # workspace: protocol dependency resolution
│   ├── packument.ts            # Registry packument (metadata) fetching
│   ├── workspace.ts            # Workspace discovery via fast-glob
│   ├── constants.ts            # Registry URL constants
│   ├── types.ts                # Shared TypeScript type definitions
│   └── utils/                  # Small utility functions
│       ├── index.ts
│       ├── is-npm-js-publish-version-conflict.ts
│       ├── is-npm-pkg-github-version-conflict.ts
│       └── object.ts
├── test/
│   ├── unit/                   # Vitest unit tests
│   │   ├── module.spec.ts
│   │   └── packument.spec.ts
│   ├── data/                   # Fixture data (mock monorepo)
│   │   ├── package.json
│   │   └── packages/
│   │       ├── pkgA/
│   │       ├── pkgB/
│   │       └── pkgC/
│   └── vitest.config.ts        # Vitest configuration
├── types/
│   └── libnpmpack.d.ts         # Ambient type declarations
├── dist/                       # Build output (generated)
├── .github/
│   ├── workflows/
│   │   ├── main.yml            # CI: lint, build, test
│   │   └── release.yml         # Release: release-please + publish
│   └── actions/
│       ├── build/action.yml    # Composite build action
│       └── install/action.yml  # Composite install action
├── package.json
├── tsconfig.json
├── rollup.config.mjs           # Rollup bundler config
├── .eslintrc                   # ESLint config
├── commitlint.config.cjs       # Conventional commit enforcement
├── .editorconfig
├── release-please-config.json
└── .husky/
    └── commit-msg              # Git hook for commit linting
```

## Module Responsibilities

| Module                 | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| `cli.ts`               | Parses CLI flags, invokes the `publish()` function           |
| `module.ts`            | Top-level orchestrator: reads workspaces → filters → publish |
| `package.ts`           | Determines publishability, queries registry, publishes       |
| `package-json.ts`      | Reads/writes `package.json` files from disk                  |
| `package-dependency.ts`| Rewrites `workspace:` protocol deps to concrete versions     |
| `packument.ts`         | Fetches packument data from npm-compatible registries        |
| `workspace.ts`         | Discovers workspace packages using glob patterns             |
| `constants.ts`         | Default registry URLs                                        |
| `types.ts`             | Shared interfaces and type aliases                           |
| `utils/`               | Version-conflict detection and object helpers                |

## Key Dependencies

| Dependency       | Role                                         |
|------------------|----------------------------------------------|
| `cac`            | Lightweight CLI argument parsing             |
| `consola`        | Structured console logging                   |
| `fast-glob`      | File system globbing for workspace discovery |
| `hapic`          | HTTP client for registry API requests        |
| `libnpmpack`     | Creates npm package tarballs                 |
| `libnpmpublish`  | Publishes tarballs to npm registries         |
| `semver`         | Semantic version comparison and validation   |
