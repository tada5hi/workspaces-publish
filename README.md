# monopub 📦

[![npm version](https://badge.fury.io/js/monopub.svg)](https://badge.fury.io/js/monopub)
[![CI](https://github.com/Tada5hi/monopub/workflows/CI/badge.svg)](https://github.com/Tada5hi/monopub)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

A CLI tool and library for publishing packages from npm workspaces to registries (npmjs.org, GitHub Packages, etc.).
It determines which workspace packages haven't been published yet by checking each package's version against the registry,
and publishes only what's needed — making it ideal for CI/CD pipelines alongside [release-please](https://github.com/googleapis/release-please).

When npm >= 10.0.0 is available, it shells out to `npm publish` directly (supporting OIDC, provenance, etc. out of the box).
Otherwise it falls back to [libnpmpublish](https://www.npmjs.com/package/libnpmpublish) / [libnpmpack](https://www.npmjs.com/package/libnpmpack).

**Table of Contents**
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Authentication](#authentication)
- [Programmatic API](#programmatic-api)
- [CI](#ci)

## Requirements

- **Node.js** >= 22.0.0
- **npm** 7+ (workspace support required)

## Installation

```bash
npm install monopub --save-dev
```

## Usage

```bash
npx monopub \
  --token <token> \
  --registry <registry> \
  --root <root> \
  --rootPackage
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--token <token>` | `string` | `NODE_AUTH_TOKEN` env var | Token for the registry. Optional when using OIDC trusted publishing. |
| `--registry <registry>` | `string` | `https://registry.npmjs.org/` | Registry URL to publish to. |
| `--root <root>` | `string` | `process.cwd()` | Directory where the root `package.json` is located. |
| `--rootPackage` | `boolean` | `true` | Also consider the root package for publishing (skipped if `private: true` or missing `name`/`version`). |

## Authentication

The tool supports three authentication methods, resolved in the following order:

1. **`--token` CLI flag** — Explicit npm access token, used as-is.
2. **OIDC Trusted Publishing** — Tokenless publishing via GitHub Actions OIDC (auto-detected when no `--token` flag is given). Falls back to `NODE_AUTH_TOKEN` if OIDC fails.
3. **`NODE_AUTH_TOKEN` environment variable** — Default fallback.

### OIDC Trusted Publishing

When running in GitHub Actions with [trusted publishers](https://docs.npmjs.com/trusted-publishers/) configured, the tool automatically detects the OIDC environment and exchanges short-lived, per-package tokens with the npm registry — no long-lived `NPM_TOKEN` secret required.

**Requirements:**
- npm trusted publisher configured for each package on [npmjs.com](https://www.npmjs.com)
- GitHub Actions workflow with `id-token: write` permission
- No `--token` flag set (OIDC is bypassed when an explicit token is provided)

**How it works:**
1. Detects `ACTIONS_ID_TOKEN_REQUEST_URL` and `ACTIONS_ID_TOKEN_REQUEST_TOKEN` environment variables
2. Requests an OIDC identity token from GitHub with audience `npm:<registry-host>`
3. Exchanges the identity token with the npm registry for a short-lived, package-scoped publish token
4. Uses that token for publishing (each package gets its own scoped token)

If OIDC token exchange fails for a package, it falls back to `NODE_AUTH_TOKEN` automatically via the chain provider.

## Programmatic API

```typescript
import { publish } from 'monopub';

const packages = await publish({
    cwd: '/path/to/monorepo',
    registry: 'https://registry.npmjs.org/',
    token: 'npm_...',
    rootPackage: true,
    dryRun: false,
});
```

The `publish()` function returns an array of `Package` objects for each successfully published package.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Root directory of the monorepo. |
| `registry` | `string` | `https://registry.npmjs.org/` | Registry URL. |
| `token` | `string` | — | Auth token (wrapped in `MemoryTokenProvider` internally). |
| `rootPackage` | `boolean` | `true` | Include the root package as a publish candidate. |
| `dryRun` | `boolean` | `false` | Resolve dependencies and check versions without actually publishing. |
| `fileSystem` | `IFileSystem` | `NodeFileSystem` | File system adapter. |
| `registryClient` | `IRegistryClient` | `HapicRegistryClient` | Registry metadata adapter. |
| `publisher` | `IPackagePublisher` | Auto-detected | Publisher adapter (npm CLI or libnpmpublish). |
| `tokenProvider` | `ITokenProvider` | `EnvTokenProvider` | Token resolution adapter (overrides `token`). |
| `logger` | `ILogger` | — | Logger adapter. |

### Custom Adapters

The library uses a hexagonal architecture — all external I/O is behind port interfaces, making it fully testable and extensible:

```typescript
import {
    publish,
    MemoryFileSystem,
    MemoryRegistryClient,
    MemoryPublisher,
    MemoryTokenProvider,
    NoopLogger,
} from 'monopub';

const packages = await publish({
    cwd: '/project',
    fileSystem: new MemoryFileSystem({ /* virtual files */ }),
    registryClient: new MemoryRegistryClient({ /* virtual packuments */ }),
    publisher: new MemoryPublisher(),
    tokenProvider: new MemoryTokenProvider('test-token'),
    logger: new NoopLogger(),
});
```

Available port interfaces and their adapters:

| Port | Real Adapters | Test Adapter |
|------|--------------|--------------|
| `IFileSystem` | `NodeFileSystem` | `MemoryFileSystem` |
| `IRegistryClient` | `HapicRegistryClient` | `MemoryRegistryClient` |
| `IPackagePublisher` | `NpmCliPublisher`, `NpmPublisher` | `MemoryPublisher` |
| `ITokenProvider` | `MemoryTokenProvider`, `EnvTokenProvider`, `OidcTokenProvider`, `ChainTokenProvider` | `MemoryTokenProvider` |
| `ILogger` | `ConsolaLogger` | `NoopLogger` |

## CI

### GitHub Actions (with npm token)

Use with [release-please](https://github.com/googleapis/release-please) — it bumps versions and creates release PRs, then `monopub` handles the actual publishing:

```yaml
on:
    push:
        branches:
            - main

permissions:
    contents: write
    pull-requests: write

jobs:
    release:
        runs-on: ubuntu-latest
        steps:
            -   uses: google-github-actions/release-please-action@v4
                id: release
                with:
                    token: ${{ secrets.GITHUB_TOKEN }}

            -   name: Checkout
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/checkout@v4

            -   name: Install Node.js
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/setup-node@v4
                with:
                    node-version: 22

            -   name: Install dependencies
                if: steps.release.outputs.releases_created == 'true'
                run: npm ci

            -   name: Publish
                if: steps.release.outputs.releases_created == 'true'
                run: npx monopub
                env:
                    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub Actions (with OIDC Trusted Publishing)

No npm token secrets needed — configure [trusted publishers](https://docs.npmjs.com/trusted-publishers/) on npmjs.com for each package instead:

```yaml
on:
    push:
        branches:
            - main

permissions:
    contents: write
    pull-requests: write
    id-token: write

jobs:
    release:
        runs-on: ubuntu-latest
        steps:
            -   uses: google-github-actions/release-please-action@v4
                id: release
                with:
                    token: ${{ secrets.GITHUB_TOKEN }}

            -   name: Checkout
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/checkout@v4

            -   name: Install Node.js
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/setup-node@v4
                with:
                    node-version: 22

            -   name: Install dependencies
                if: steps.release.outputs.releases_created == 'true'
                run: npm ci

            -   name: Publish
                if: steps.release.outputs.releases_created == 'true'
                run: npx monopub
```

## License

MIT
