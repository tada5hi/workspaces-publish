# Architecture

## Overview

wspublish uses a **hexagonal architecture** (ports & adapters) pattern. All external I/O (filesystem, HTTP, npm publish, authentication) is abstracted behind port interfaces defined in `src/core/<domain>/types.ts`. Real adapters implement these for production; memory/fake adapters implement them for testing.

The CLI (`cli.ts`) serves as the **composition root**, wiring real adapters and injecting them into the orchestrator.

```
CLI (composition root)
       │  wires adapters
       ▼
  publish() orchestrator  (module.ts)
       │  receives ports via PublishOptions
       │
       ├─► IFileSystem         → read root package.json, discover workspaces, write modified deps
       ├─► ITokenProvider      → resolve auth token per package (static, env, or OIDC)
       ├─► IRegistryClient     → check if version already published
       ├─► IPackagePublisher   → pack tarball & publish to registry
       └─► ILogger             → structured output (unused in orchestrator, used in CLI)
```

## Port Interfaces

### IFileSystem (`core/filesystem/types.ts`)

```typescript
interface IFileSystem {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    glob(patterns: string[], options: { cwd?: string; ignore?: string[] }): Promise<string[]>;
}
```

Adapters: `NodeFileSystem` (node:fs + fast-glob), `MemoryFileSystem` (in-memory Map)

### IRegistryClient (`core/registry-client/types.ts`)

```typescript
interface IRegistryClient {
    getPackument(name: string, options: { registry: string; token?: string }): Promise<Packument>;
}
```

Adapters: `HapicRegistryClient` (hapic HTTP), `MemoryRegistryClient` (in-memory store)

### IPackagePublisher (`core/publisher/types.ts`)

```typescript
interface IPackagePublisher {
    publish(packagePath: string, manifest: PackageJson, options: Record<string, any>): Promise<boolean>;
}
```

Returns `true` if published, `false` if the version already exists (conflict). Throws `PublishError` on non-conflict failures.

Adapters:
- `NpmCliPublisher` — shells out to `npm publish` (primary, used when npm >= 10.0.0)
- `NpmPublisher` — uses libnpmpack + libnpmpublish (fallback)
- `MemoryPublisher` — records calls (for tests), always returns `true`

Use `resolvePublisher()` factory to auto-detect the best adapter.

### ITokenProvider (`core/token-provider/types.ts`)

```typescript
interface ITokenProvider {
    getToken(packageName: string, registry: string): Promise<string | undefined>;
}
```

The `packageName` parameter is critical — OIDC tokens from npm are scoped per package.

Adapters:
- `MemoryTokenProvider` — wraps an optional string token (production + tests)
- `EnvTokenProvider` — reads `NODE_AUTH_TOKEN` env var
- `OidcTokenProvider` — GitHub Actions OIDC → npm registry token exchange
- `ChainTokenProvider` — tries providers in order until one returns a token

### ILogger (`core/logger/types.ts`)

```typescript
interface ILogger {
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
```

Adapters: `ConsolaLogger` (wraps consola), `NoopLogger` (silent)

## Dependency Injection

Ports are injected via the `PublishOptions` type. All are optional with sensible defaults:

```typescript
type PublishOptions = {
    cwd?: string;
    rootPackage?: boolean;
    registry?: string;
    token?: string;           // backward compat: wrapped in MemoryTokenProvider
    dryRun?: boolean;
    fileSystem?: IFileSystem;
    registryClient?: IRegistryClient;
    publisher?: IPackagePublisher;
    tokenProvider?: ITokenProvider;
    logger?: ILogger;
};
```

When no adapters are provided, `module.ts` defaults to real adapters (`NodeFileSystem`, `HapicRegistryClient`, `resolvePublisher()`). The `token` field is backward-compatible — if set, it's wrapped in a `MemoryTokenProvider`.

## Data Flow

```
Input:
  ├── Root directory (--root flag or cwd)
  ├── Registry URL (--registry flag or default npmjs.org)
  ├── Auth token (--token flag, NODE_AUTH_TOKEN env, or OIDC auto-detected)
  └── Optional adapter overrides

Processing:
  1. Read root package.json via IFileSystem
  2. Discover workspace dirs via IFileSystem.glob()
  3. Read each workspace's package.json via IFileSystem
  4. Resolve workspace: protocol dependencies (pure logic, no I/O)
  5. For each publishable candidate:
     a. Resolve token via ITokenProvider.getToken(packageName, registry)
     b. Check registry via IRegistryClient.getPackument()
     c. If unpublished & modified: write package.json via IFileSystem (unless dryRun)
  6. Publish via IPackagePublisher.publish(packagePath, manifest, options)
  7. Collect results

Output:
  └── Array of published Package objects
```

## Publishing Flow

### Publisher Selection (`resolvePublisher()`)

`resolvePublisher()` in `src/core/publisher/resolve.ts` auto-detects the best adapter:

1. Runs `npm --version` via `execFile`
2. If npm >= 10.0.0 → returns `NpmCliPublisher` (shells out to `npm publish`)
3. If npm is missing or too old → returns `NpmPublisher` (libnpmpack + libnpmpublish)

`resolvePublisher()` accepts an injectable `execFn` for version detection. When `NpmCliPublisher` is selected, the same `execFn` is passed into its constructor.

### NpmCliPublisher

Shells out to `npm publish` with flags derived from the options object:

| Options key | CLI flag |
|-------------|----------|
| `//<host>/:_authToken` | `--registry https://<host>` + `NODE_AUTH_TOKEN` env var |
| `access` | `--access <value>` |
| `tag` | `--tag <value>` |

**Version conflict detection**: `npm publish` exits non-zero on failure. The private `isVersionConflict()` method inspects `stderr` and `message` directly for known conflict patterns:

| stderr pattern | Meaning |
|----------------|---------|
| `EPUBLISHCONFLICT` | npmjs.org rejects duplicate version |
| `You cannot publish over the previously published versions` | npmjs.org pre-check (npm >= 10) |
| `Cannot publish over existing version` | GitHub Packages 409 |
| `409 Conflict` | GitHub Packages 409 |

When a conflict is detected, `publish()` returns `false` instead of throwing. Non-conflict errors are wrapped in `PublishError`.

### NpmPublisher (fallback)

Uses `libnpmpack(packagePath)` to create a tarball, then `libnpmpublish.publish(manifest, tarball, options)`. This adapter receives the auth token and registry via the options object directly (libnpmpublish's native format: `{ '//registry.npmjs.org/:_authToken': 'token' }`).

Version conflicts from libnpmpublish (structured error objects with `.code` like `EPUBLISHCONFLICT`, `E403`, `E409`) are detected by private `isNpmJsVersionConflict()` and `isNpmPkgGitHubVersionConflict()` methods and return `false`. Non-conflict errors are wrapped in `PublishError`.

## Authentication Flow

### Token Resolution Order (CLI composition root)

`cli.ts` resolves the token provider in this priority:

1. **`--token` flag** → `MemoryTokenProvider(token)` — explicit token, used as-is
2. **GitHub Actions OIDC detected** (`ACTIONS_ID_TOKEN_REQUEST_URL` + `ACTIONS_ID_TOKEN_REQUEST_TOKEN` env vars present) → `ChainTokenProvider([OidcTokenProvider, EnvTokenProvider])` — tries OIDC first, falls back to env
3. **Default** → `EnvTokenProvider` — reads `NODE_AUTH_TOKEN` env var

### OIDC Trusted Publishing

When running in GitHub Actions with [trusted publishers](https://docs.npmjs.com/trusted-publishers/) configured:

1. CLI detects `ACTIONS_ID_TOKEN_REQUEST_URL` + `ACTIONS_ID_TOKEN_REQUEST_TOKEN` env vars
2. Creates `ChainTokenProvider([OidcTokenProvider, EnvTokenProvider])` as fallback chain
3. `OidcTokenProvider` per package:
   a. Requests OIDC identity token from GitHub with audience `npm:<registry-host>`
   b. Exchanges identity token with npm at `POST /-/npm/v1/oidc/token/exchange/package/{name}`
   c. Receives short-lived, package-scoped publish token
   d. Caches token per package name within the provider instance

The OIDC flow is fully testable via the injectable `fetchFn` constructor parameter.

**Key env vars for GitHub Actions OIDC:**
- `ACTIONS_ID_TOKEN_REQUEST_URL` — GitHub's OIDC token endpoint (e.g. `https://token.actions.githubusercontent.com/.well-known/openid-configuration`)
- `ACTIONS_ID_TOKEN_REQUEST_TOKEN` — Bearer token to authenticate the OIDC request
- These are automatically set by GitHub when `permissions: id-token: write` is configured

**OIDC token exchange with npm:**
- Audience: `npm:<registry-host>` (e.g. `npm:registry.npmjs.org`)
- Exchange endpoint: `POST https://<registry>/-/npm/v1/oidc/token/exchange/package/<url-encoded-name>`
- Response: `{ "token": "<short-lived-npm-token>" }`
- Tokens are package-scoped and short-lived

### Interaction Between Token Provider and NpmCliPublisher

When `NpmCliPublisher` is selected and OIDC is active, two OIDC-capable systems coexist:

1. **Our `OidcTokenProvider`** fetches a per-package token and passes it via `publishOptions`
2. **npm CLI** (>= 11.x) can also do native OIDC when it sees the GitHub Actions env vars

In practice, our token provider runs first. The resulting token is set as `NODE_AUTH_TOKEN` in the child process env. npm CLI sees this and uses it directly — it does **not** perform its own OIDC exchange. This is intentional: our provider acts as a safety net, and the npm CLI's native OIDC serves as an implicit fallback if our provider ever fails silently.

We chose **not** to skip our OIDC provider when the CLI adapter is selected because:
- We cannot guarantee the npm CLI version supports OIDC (requires >= 11.x, but we accept >= 10.0.0)
- The npm CLI could become unavailable between `resolvePublisher()` and the actual publish
- The redundancy adds resilience with negligible cost (one extra HTTP call per package)

## Core Design Decisions

### 1. Hexagonal Architecture

All external I/O is behind port interfaces. This enables:
- Testing with memory adapters (no `vi.mock`, no network calls)
- Swapping implementations (npm CLI vs libnpmpublish)
- Clear dependency boundaries

### 2. Per-Package Token Resolution

Tokens are resolved per package (`getToken(packageName, registry)`), not once globally. This is required because OIDC tokens from npm are scoped to individual package names.

### 3. Workspace Protocol Resolution

Pure logic in `package-dependency.ts` — rewrites `workspace:*`/`^`/`~` to concrete versions. No I/O, fully testable without adapters.

### 4. Version Conflict Detection

Each publisher adapter handles its own conflict detection internally:
- `NpmCliPublisher` — private `isVersionConflict()` inspects `stderr`/`message` for known patterns
- `NpmPublisher` — private `isNpmJsVersionConflict()` and `isNpmPkgGitHubVersionConflict()` inspect structured error objects from libnpmpublish

Both return `false` from `publish()` on conflict instead of throwing. This keeps conflict handling co-located with the adapter that produces the errors.

### 5. Publisher Selection

`resolvePublisher()` prefers `NpmCliPublisher` (npm >= 10.0.0) over `NpmPublisher` (libnpmpublish). The npm CLI handles OIDC, provenance, and other registry features natively. The libnpmpublish fallback exists for environments without a suitable npm CLI.

## Error Class Hierarchy

A base error class in `src/core/error.ts` provides typed `code` and `statusCode` fields:

```text
BaseError (code, statusCode)
├── RegistryError    — thrown by registry client adapters (e.g. 404 not found, 500 server error)
└── PublishError     — thrown by publisher adapters on non-conflict failures
```

Duck-type guards (`isRegistryError()`, `isError()`, `isObject()`) are used instead of `instanceof` for cross-realm safety.

## Error Handling

- Registry errors are typed via `RegistryError` — 404s (package not found) are treated as "not published", all other status codes propagate
- Version conflicts (already published) are handled inside each publisher adapter — `publish()` returns `false`
- Invalid package configurations (missing name, version) cause the package to be skipped
- OIDC failures in `ChainTokenProvider` propagate (the chain only falls through on `undefined` return, not on thrown errors)
- Non-conflict publish failures are wrapped in `PublishError` with the original error as `cause`
- Invalid root `package.json` JSON produces a descriptive error message
- Invalid registry URLs are caught in the CLI before any publish attempt
