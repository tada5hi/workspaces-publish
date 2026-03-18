# Project Structure

workspaces-publish is a single-package repository (not a monorepo itself), but it is a tool designed to publish monorepo workspaces.

## Directory Layout

```
workspaces-publish/
├── src/                                # TypeScript source
│   ├── cli.ts                          # CLI entry point & composition root
│   ├── index.ts                        # Library entry point (public API exports)
│   ├── module.ts                       # Core publish() orchestration function
│   ├── package.ts                      # Package publish logic (accepts port interfaces)
│   ├── package-dependency.ts           # workspace: protocol dependency resolution
│   ├── constants.ts                    # Registry URL constants
│   ├── types.ts                        # PublishOptions type (references port interfaces)
│   ├── core/                           # Hexagonal architecture: ports & adapters
│   │   ├── index.ts                    # Barrel export for all core modules
│   │   ├── filesystem/                 # File system port
│   │   │   ├── types.ts                # IFileSystem interface
│   │   │   ├── node-filesystem.ts      # Real adapter (node:fs + fast-glob)
│   │   │   ├── memory-filesystem.ts    # Fake adapter (in-memory Map)
│   │   │   └── index.ts
│   │   ├── registry-client/            # Registry packument port
│   │   │   ├── types.ts                # IRegistryClient, Packument, PackumentVersion
│   │   │   ├── hapic-registry-client.ts # Real adapter (hapic HTTP)
│   │   │   ├── memory-registry-client.ts # Fake adapter (in-memory store)
│   │   │   └── index.ts
│   │   ├── publisher/                  # Package publish port
│   │   │   ├── types.ts                # IPackagePublisher interface
│   │   │   ├── npm-publisher.ts        # Real adapter (libnpmpack + libnpmpublish)
│   │   │   ├── memory-publisher.ts     # Fake adapter (records calls)
│   │   │   └── index.ts
│   │   ├── token-provider/             # Authentication port
│   │   │   ├── types.ts                # ITokenProvider interface
│   │   │   ├── static-token-provider.ts # Wraps a plain string token
│   │   │   ├── env-token-provider.ts   # Reads NODE_AUTH_TOKEN env var
│   │   │   ├── oidc-token-provider.ts  # GitHub OIDC → npm token exchange
│   │   │   ├── chain-token-provider.ts # Tries providers in order
│   │   │   ├── memory-token-provider.ts # Fake adapter for tests
│   │   │   └── index.ts
│   │   ├── logger/                     # Logging port
│   │   │   ├── types.ts                # ILogger interface
│   │   │   ├── consola-logger.ts       # Real adapter (wraps consola)
│   │   │   ├── noop-logger.ts          # Silent adapter for tests
│   │   │   └── index.ts
│   │   └── package/                    # Domain model types
│   │       ├── types.ts                # PackageJson, Package
│   │       └── index.ts
│   └── utils/                          # Small utility functions
│       ├── index.ts
│       ├── is-npm-js-publish-version-conflict.ts
│       ├── is-npm-pkg-github-version-conflict.ts
│       └── object.ts
├── test/
│   ├── unit/                           # Vitest unit tests
│   │   ├── module.spec.ts              # Publish orchestrator tests
│   │   ├── package.spec.ts             # Package logic tests
│   │   ├── package-dependency.spec.ts  # Workspace dep resolution tests
│   │   ├── oidc-token-provider.spec.ts # OIDC flow tests
│   │   ├── chain-token-provider.spec.ts # Chain fallback tests
│   │   └── token-provider.spec.ts      # Static/Env/Memory provider tests
│   ├── data/                           # Fixture data (mock monorepo)
│   │   ├── package.json
│   │   └── packages/
│   │       ├── pkgA/
│   │       ├── pkgB/
│   │       └── pkgC/
│   └── vitest.config.ts                # Vitest configuration
├── types/
│   └── libnpmpack.d.ts                 # Ambient type declarations
├── dist/                               # Build output (generated)
├── .github/
│   ├── workflows/
│   │   ├── main.yml                    # CI: lint, build, test
│   │   └── release.yml                 # Release: release-please + publish
│   └── actions/
│       ├── build/action.yml            # Composite build action
│       └── install/action.yml          # Composite install action
├── .agents/
│   ├── structure.md                    # This file
│   ├── architecture.md                 # Hexagonal design & data flow
│   ├── testing.md                      # Test setup & conventions
│   ├── conventions.md                  # Code style & workflow rules
│   └── plans/                          # Follow-up implementation plans
│       └── npm-cli-publisher.md        # Plan: prefer npm CLI over libnpmpublish
├── package.json
├── tsconfig.json
├── rollup.config.mjs                   # Rollup bundler config
├── .eslintrc                           # ESLint config
├── commitlint.config.cjs              # Conventional commit enforcement
├── .editorconfig
├── release-please-config.json
└── .husky/
    └── commit-msg                      # Git hook for commit linting
```

## Module Responsibilities

| Module                 | Purpose                                                              |
|------------------------|----------------------------------------------------------------------|
| `cli.ts`               | Composition root: parses CLI flags, wires adapters, invokes publish  |
| `module.ts`            | Top-level orchestrator: resolves adapters, reads workspaces, filters, publishes |
| `package.ts`           | Business logic: publishability check, version check, publish call    |
| `package-dependency.ts`| Pure logic: rewrites `workspace:` protocol deps to concrete versions |
| `constants.ts`         | Default registry URLs                                                |
| `types.ts`             | `PublishOptions` type (references all port interfaces)               |
| `core/`                | Hexagonal port interfaces and their adapter implementations          |
| `utils/`               | Version-conflict detection and object helpers                        |

## Core Domain Modules

Each folder under `src/core/` contains a port interface (`types.ts`), one or more real adapters, and a memory/fake adapter for testing:

| Domain           | Port Interface      | Key Types                    |
|------------------|---------------------|------------------------------|
| `filesystem/`    | `IFileSystem`       | readFile, writeFile, glob    |
| `registry-client/` | `IRegistryClient` | Packument, PackumentVersion  |
| `publisher/`     | `IPackagePublisher` | pack, publish                |
| `token-provider/`| `ITokenProvider`    | getToken(packageName, registry) |
| `logger/`        | `ILogger`           | info, success, warn, error   |
| `package/`       | (domain types only) | PackageJson, Package         |

## Key Dependencies

| Dependency       | Role                                         |
|------------------|----------------------------------------------|
| `cac`            | Lightweight CLI argument parsing             |
| `consola`        | Structured console logging (via adapter)     |
| `fast-glob`      | File system globbing (via adapter)           |
| `hapic`          | HTTP client for registry API (via adapter)   |
| `libnpmpack`     | Creates npm package tarballs (via adapter)   |
| `libnpmpublish`  | Publishes tarballs to registries (via adapter) |
| `semver`         | Semantic version comparison and validation   |
