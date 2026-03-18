# Architecture

## Overview

workspaces-publish uses a **hexagonal architecture** (ports & adapters) pattern. All external I/O (filesystem, HTTP, npm publish, authentication) is abstracted behind port interfaces defined in `src/core/<domain>/types.ts`. Real adapters implement these for production; memory/fake adapters implement them for testing.

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
    publish(packagePath: string, manifest: PackageJson, options: Record<string, any>): Promise<void>;
}
```

Adapters:
- `NpmCliPublisher` — shells out to `npm publish` (primary, used when npm >= 10.0.0)
- `NpmPublisher` — uses libnpmpack + libnpmpublish (fallback)
- `MemoryPublisher` — records calls (for tests)

Use `resolvePublisher()` factory to auto-detect the best adapter.

### ITokenProvider (`core/token-provider/types.ts`)

```typescript
interface ITokenProvider {
    getToken(packageName: string, registry: string): Promise<string | undefined>;
}
```

The `packageName` parameter is critical — OIDC tokens from npm are scoped per package.

Adapters:
- `StaticTokenProvider` — wraps a plain string token
- `EnvTokenProvider` — reads `NODE_AUTH_TOKEN` env var
- `OidcTokenProvider` — GitHub Actions OIDC → npm registry token exchange
- `ChainTokenProvider` — tries providers in order until one returns a token
- `MemoryTokenProvider` — returns a configured value (for tests)

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
    token?: string;           // backward compat: wrapped in StaticTokenProvider
    dryRun?: boolean;
    fileSystem?: IFileSystem;
    registryClient?: IRegistryClient;
    publisher?: IPackagePublisher;
    tokenProvider?: ITokenProvider;
    logger?: ILogger;
};
```

When no adapters are provided, `module.ts` defaults to real adapters (`NodeFileSystem`, `HapicRegistryClient`, `NpmPublisher`). The `token` field is backward-compatible — if set, it's wrapped in a `StaticTokenProvider`.

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
  6. Publish via IPackagePublisher.pack() + IPackagePublisher.publish()
  7. Collect results

Output:
  └── Array of published Package objects
```

## OIDC Trusted Publishing

When running in GitHub Actions with [trusted publishers](https://docs.npmjs.com/trusted-publishers/) configured:

1. CLI detects `ACTIONS_ID_TOKEN_REQUEST_URL` + `ACTIONS_ID_TOKEN_REQUEST_TOKEN` env vars
2. Creates `ChainTokenProvider([OidcTokenProvider, EnvTokenProvider])` as fallback chain
3. `OidcTokenProvider` per package:
   a. Requests OIDC identity token from GitHub with audience `npm:<registry-host>`
   b. Exchanges identity token with npm at `POST /-/npm/v1/oidc/token/exchange/package/{name}`
   c. Receives short-lived, package-scoped publish token
   d. Caches token per package name within the provider instance

The OIDC flow is fully testable via the injectable `fetchFn` constructor parameter.

## Core Design Decisions

### 1. Hexagonal Architecture

All external I/O is behind port interfaces. This enables:
- Testing with memory adapters (no `vi.mock`, no network calls)
- Swapping implementations (e.g., future npm CLI adapter)
- Clear dependency boundaries

### 2. Per-Package Token Resolution

Tokens are resolved per package (`getToken(packageName, registry)`), not once globally. This is required because OIDC tokens from npm are scoped to individual package names.

### 3. Workspace Protocol Resolution

Pure logic in `package-dependency.ts` — rewrites `workspace:*`/`^`/`~` to concrete versions. No I/O, fully testable without adapters.

### 4. Version Conflict Detection

Two utilities handle registry-specific conflict responses:
- `is-npm-js-publish-version-conflict.ts` — npmjs.org errors
- `is-npm-pkg-github-version-conflict.ts` — GitHub Packages errors

These treat "already published" as a non-error condition.

## Error Handling

- Registry network errors are propagated to the caller
- Version conflicts (already published) are caught and treated as successful no-ops
- Invalid package configurations (missing name, version) cause the package to be skipped
- OIDC failures throw descriptive errors for CI/CD diagnosis
