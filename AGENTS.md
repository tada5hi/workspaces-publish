<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# Workspaces Publish — Agent Guide

## Project Overview

**workspaces-publish** is a Node.js CLI tool and library that publishes packages from npm workspaces to registries (npmjs.org, GitHub Packages, etc.). It determines which workspace packages haven't been published yet by querying registry metadata, resolves `workspace:` protocol dependencies to real versions, and publishes only what's needed — making it ideal for CI/CD pipelines alongside release-please.

- **Repository**: https://github.com/tada5hi/workspaces-publish
- **Package**: `@tada5hi/workspaces-publish`
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
workspaces-publish --token <npm-token> [--registry <url>] [--root <path>] [--rootPackage]
```

The CLI entry point is `src/cli.ts`, built to `dist/cli.mjs`. The token defaults to the `NODE_AUTH_TOKEN` environment variable.

## Entry Points

| Entry         | Source         | Output           | Description                     |
|---------------|----------------|------------------|---------------------------------|
| Library       | `src/index.ts` | `dist/index.mjs` | Programmatic API                |
| CLI           | `src/cli.ts`   | `dist/cli.mjs`   | Command-line interface          |

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Source layout and module responsibilities
- **[Architecture](.agents/architecture.md)** — Core design, data flow, and key patterns
- **[Testing](.agents/testing.md)** — Test setup, conventions, and coverage
- **[Conventions](.agents/conventions.md)** — Code style, tooling, and workflow rules
