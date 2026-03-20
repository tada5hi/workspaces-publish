<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# monopub — Agent Guide

## Project Overview

**monopub** is a Node.js CLI tool and library that publishes packages from npm workspaces to registries (npmjs.org, GitHub Packages, etc.). It determines which workspace packages haven't been published yet by querying registry metadata, resolves `workspace:` protocol dependencies to real versions, and publishes only what's needed — making it ideal for CI/CD pipelines alongside release-please.

The project uses a **hexagonal architecture** (ports & adapters) — all external I/O is behind port interfaces with memory/fake adapters for testing. Authentication supports static tokens, environment variables, and OIDC trusted publishing.

- **Repository**: https://github.com/tada5hi/monopub
- **Package**: `monopub`
- **License**: MIT

## Quick Reference

### Requirements

- **Node.js**: >= 22.0.0
- **npm**: 7+ (workspace support required)

### Setup

```bash
npm ci
```

### Key Commands

| Command                | Description                        |
|------------------------|------------------------------------|
| `npm run build`        | Clean, compile types, bundle JS    |
| `npm run build:types`  | Emit TypeScript declarations only  |
| `npm run build:js`     | Bundle with Rollup                 |
| `npm run lint`         | Run ESLint                         |
| `npm run lint:fix`     | Run ESLint with auto-fix           |
| `npm run test`         | Run Vitest test suite              |
| `npm run test:coverage`| Run tests with coverage report     |

### CLI Usage

```bash
monopub [--token <npm-token>] [--registry <url>] [--root <path>] [--rootPackage]
```

The CLI entry point is `src/cli.ts`, built to `dist/cli.mjs`. The token is optional — it defaults to `NODE_AUTH_TOKEN` env var, or OIDC trusted publishing when running in GitHub Actions.

## Entry Points

| Entry         | Source         | Output           | Description                     |
|---------------|----------------|------------------|---------------------------------|
| Library       | `src/index.ts` | `dist/index.mjs` | Programmatic API                |
| CLI           | `src/cli.ts`   | `dist/cli.mjs`   | Command-line interface          |

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Source layout, core modules, and domain folders
- **[Architecture](.agents/architecture.md)** — Hexagonal design, port interfaces, data flow, OIDC
- **[Testing](.agents/testing.md)** — Memory adapters, test conventions, no vi.mock
- **[Conventions](.agents/conventions.md)** — Code style, ESLint constraints, hexagonal rules

