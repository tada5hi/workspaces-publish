# workspaces-publish

[![npm version](https://badge.fury.io/js/workspaces-publish.svg)](https://badge.fury.io/js/workspaces-publish)
[![Master Workflow](https://github.com/Tada5hi/workspaces-publish/workflows/CI/badge.svg)](https://github.com/Tada5hi/workspaces-publish)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/workspaces-publish/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/workspaces-publish?targetFile=package.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This library facilitates the publication of packages encompassing multiple workspaces as defined in a package.json file.
It determines the unpublished packages by checking each package manifest of the registry,
if one already exists.

At best, it should be used with a library that increments the version of the packages beforehand
(e.g. [release-please](https://github.com/googleapis/release-please)).

It is based on the packages
([libnpmpublish](https://www.npmjs.com/package/libnpmpublish),
[libnpmpack](https://www.npmjs.com/package/libnpmpack))
that the npm cli uses to publish packages.

**Table of Contents**
- [Installation](#installation)
- [Usage](#usage)
- [Authentication](#authentication)
- [Programmatic API](#programmatic-api)
- [CI](#ci)

## Installation

```bash
npm install workspaces-publish --save-dev
```

## Usage

```bash
npx workspaces-publish \
  --token <token> \
  --registry <registry> \
  --root <root> \
  --rootPackage
```

### Options

#### token
- Type: `String`
- Default: `process.env.NODE_AUTH_TOKEN`
- Description: Token for the registry. Optional when using OIDC trusted publishing.

#### registry
- Type: `String`
- Default: `https://registry.npmjs.org/`
- Description: Registry url.

#### root
- Type: `String`
- Default: `process.cwd()`
- Description: Directory where the root package is located.

#### rootPackage
- Type: `Boolean`
- Default: `true`
- Description: Also consider the root package for publishing. The library still
  checks whether a name- & version-property is set and whether the private property evaluates to false.

## Authentication

The library supports three authentication methods, resolved in the following order:

1. **`--token` CLI flag** — Explicit npm access token
2. **OIDC Trusted Publishing** — Tokenless publishing via GitHub Actions OIDC (auto-detected)
3. **`NODE_AUTH_TOKEN` environment variable** — Fallback to the environment variable

### OIDC Trusted Publishing

When running in GitHub Actions with [trusted publishers](https://docs.npmjs.com/trusted-publishers/) configured, the library automatically detects the OIDC environment and exchanges short-lived tokens with the npm registry — no long-lived `NPM_TOKEN` required.

**Requirements:**
- npm trusted publisher configured for each package on npmjs.com
- GitHub Actions workflow with `id-token: write` permission
- Node.js >= 22.0.0
- No `--token` flag or `NODE_AUTH_TOKEN` set (OIDC activates only when no explicit token is present)

**How it works:**
1. Detects `ACTIONS_ID_TOKEN_REQUEST_URL` and `ACTIONS_ID_TOKEN_REQUEST_TOKEN` environment variables
2. Requests an OIDC identity token from GitHub with audience `npm:<registry-host>`
3. Exchanges the identity token with the npm registry for a short-lived, package-scoped publish token
4. Uses that token for publishing (each package gets its own token)

## Programmatic API

```typescript
import { publish } from 'workspaces-publish';

const packages = await publish({
    cwd: '/path/to/monorepo',
    registry: 'https://registry.npmjs.org/',
    token: 'npm_...',
    rootPackage: true,
    dryRun: false,
});
```

### Custom Adapters

The library uses a hexagonal architecture (ports & adapters). All external I/O is abstracted behind interfaces, making it fully testable and extensible:

```typescript
import { publish } from 'workspaces-publish';
import {
    MemoryFileSystem,
    MemoryRegistryClient,
    MemoryPublisher,
    MemoryTokenProvider,
    NoopLogger,
} from 'workspaces-publish';

// Use memory adapters for testing
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

| Port | Real Adapter | Test Adapter |
|------|-------------|-------------|
| `IFileSystem` | `NodeFileSystem` | `MemoryFileSystem` |
| `IRegistryClient` | `HapicRegistryClient` | `MemoryRegistryClient` |
| `IPackagePublisher` | `NpmPublisher` | `MemoryPublisher` |
| `ITokenProvider` | `StaticTokenProvider`, `EnvTokenProvider`, `OidcTokenProvider`, `ChainTokenProvider` | `MemoryTokenProvider` |
| `ILogger` | `ConsolaLogger` | `NoopLogger` |

## CI

### GitHub Action (with npm token)

The library can be used in combination with [release-please](https://github.com/googleapis/release-please),
as release-please only increases the versions in the monorepo, but does not release the packages.

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

            -   name: Install Node.JS
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/setup-node@v4
                with:
                    node-version: 22

            -   name: Install dependencies
                if: steps.release.outputs.releases_created == 'true'
                run: npm ci

            -   name: Publish
                if: steps.release.outputs.releases_created == 'true'
                run: npx workspaces-publish
                env:
                    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitHub Action (with OIDC Trusted Publishing)

No npm token secrets needed — configure [trusted publishers](https://docs.npmjs.com/trusted-publishers/) on npmjs.com for each package instead.

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

            -   name: Install Node.JS
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/setup-node@v4
                with:
                    node-version: 22

            -   name: Install dependencies
                if: steps.release.outputs.releases_created == 'true'
                run: npm ci

            -   name: Publish
                if: steps.release.outputs.releases_created == 'true'
                run: npx workspaces-publish
```
