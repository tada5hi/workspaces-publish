# Plan: Prefer npm CLI for publishing with libnpmpublish fallback

## Motivation

The npm CLI (v11.5.1+) has built-in support for OIDC trusted publishing, provenance attestation, and other registry features that are difficult to replicate with `libnpmpublish` directly. By shelling out to `npm publish` when the CLI is available, we get these features for free and reduce maintenance burden. The existing `NpmPublisher` adapter (libnpmpack + libnpmpublish) becomes the fallback for environments where the npm CLI is not installed or is too old.

This fits cleanly into our hexagonal architecture — we add a new `IPackagePublisher` adapter (`NpmCliPublisher`) and a detection/fallback mechanism.

## Design

### New adapter: `NpmCliPublisher`

Located at `src/core/publisher/npm-cli-publisher.ts`, implements `IPackagePublisher`.

**`pack(packagePath)`:**
- Runs `npm pack --json` in the package directory
- Parses the JSON output to get the tarball filename
- Reads the tarball from disk and returns the Buffer
- Note: The tarball path is relative to the package directory

**`publish(manifest, tarball, options)`:**
- Does NOT use the tarball parameter — npm CLI packs and publishes in one step
- Runs `npm publish` in the package directory
- Passes auth via `--registry` and environment variable `NODE_AUTH_TOKEN`
- The npm CLI auto-detects OIDC, handles provenance, etc.

**Important**: Since `npm publish` packs and publishes atomically, the current two-step flow (`pack()` then `publish()`) doesn't map cleanly. Two options:

### Option A: Refactor IPackagePublisher to single method (recommended)

Change the port interface to combine pack + publish:

```typescript
interface IPackagePublisher {
    publish(packagePath: string, manifest: PackageJson, options: Record<string, any>): Promise<void>;
}
```

- `NpmCliPublisher`: runs `npm publish` in `packagePath`
- `NpmPublisher` (libnpmpublish fallback): calls `libnpmpack(packagePath)` then `libnpmpublish.publish(manifest, tarball, options)` internally
- `MemoryPublisher`: records the call for testing

This is cleaner because the pack step is an implementation detail — consumers only care about "publish this package".

### Option B: Keep two-step interface, make pack() a no-op in CLI adapter

- `NpmCliPublisher.pack()` returns a dummy Buffer
- `NpmCliPublisher.publish()` ignores the tarball and runs `npm publish` directly
- Downside: the interface leaks an abstraction that doesn't apply to the CLI path

**Recommendation: Option A.** The `pack()` method is never called independently — it's always immediately followed by `publish()`. Merging them simplifies the interface and makes the CLI adapter natural.

### Detection & fallback

Add a factory function that probes for the npm CLI and returns the appropriate adapter:

```typescript
// src/core/publisher/resolve.ts
async function resolvePublisher(): Promise<IPackagePublisher> {
    try {
        const { stdout } = await exec('npm --version');
        const version = stdout.trim();
        if (semver.gte(version, '11.5.1')) {
            return new NpmCliPublisher();
        }
    } catch (e) {
        // npm not found
    }
    return new NpmPublisher();
}
```

The minimum version `11.5.1` ensures OIDC support. If the user explicitly passes a `publisher` in `PublishOptions`, that takes precedence (no detection).

### Changes to `package.ts`

`publishPackage()` currently calls `publisher.pack()` then `publisher.publish()`. With Option A, this simplifies to:

```typescript
export async function publishPackage(
    pkg: Package,
    publisher: IPackagePublisher,
    options: { token?: string; registry: string },
): Promise<boolean> {
    const publishOptions: Record<string, any> = {
        ...(pkg.content.publishConfig || {}),
    };

    if (options.token && options.token.length > 0) {
        const url = new URL(options.registry || 'https://registry.npmjs.org/');
        publishOptions[`//${url.host}/:_authToken`] = options.token;
    }

    try {
        await publisher.publish(pkg.path, pkg.content, publishOptions);
        return true;
    } catch (e) {
        if (isNpmJsPublishVersionConflict(e) || isNpmPkgGitHubPublishVersionConflict(e)) {
            return false;
        }
        throw e;
    }
}
```

### NpmCliPublisher implementation details

```typescript
// src/core/publisher/npm-cli-publisher.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class NpmCliPublisher implements IPackagePublisher {
    async publish(
        packagePath: string,
        manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<void> {
        const args = ['publish'];

        // Extract registry from options
        const authTokenKey = Object.keys(options).find((k) => k.includes(':_authToken'));
        const registry = authTokenKey
            ? `https:${authTokenKey.replace('/:_authToken', '')}`
            : undefined;

        if (registry) {
            args.push('--registry', registry);
        }

        // Build env with token
        const env = { ...process.env };
        if (authTokenKey && options[authTokenKey]) {
            env.NODE_AUTH_TOKEN = options[authTokenKey];
        }

        if (options.access) {
            args.push('--access', options.access);
        }

        await execFileAsync('npm', args, {
            cwd: packagePath,
            env,
        });
    }
}
```

Key points:
- Runs `npm publish` in the workspace package directory
- Passes the token via `NODE_AUTH_TOKEN` env var (npm CLI picks it up)
- When no token is set and OIDC env vars are present, npm CLI handles OIDC automatically
- Passes `--registry` and `--access` flags as needed

### Impact on OIDC flow

When using `NpmCliPublisher` with npm >= 11.5.1:
- The `OidcTokenProvider` becomes unnecessary — npm CLI handles OIDC internally
- The `ChainTokenProvider` and OIDC detection in `cli.ts` are still useful as fallback logic
- If the CLI adapter is selected, the token provider can be simplified to just `EnvTokenProvider` (or none at all)

### Impact on token provider

When using the npm CLI adapter, tokens should be passed via environment variable rather than the `_authToken` config format. The `NpmCliPublisher` handles this by setting `NODE_AUTH_TOKEN` in the child process env.

For OIDC: if npm CLI >= 11.5.1 is detected, the CLI composition root can skip OIDC token provider setup entirely — npm will handle it.

## Implementation Steps

1. **Refactor `IPackagePublisher` interface** — merge `pack()` + `publish()` into single `publish(packagePath, manifest, options)` method
2. **Update `NpmPublisher`** — internalize the pack step
3. **Update `MemoryPublisher`** — adapt to new interface
4. **Update `package.ts`** — simplify `publishPackage()` to use new interface
5. **Update tests** — adapt to new interface
6. **Create `NpmCliPublisher`** — implement using `execFile('npm', ['publish', ...])`
7. **Create `resolvePublisher()`** — factory with npm version detection
8. **Create `MemoryExecPublisher`** (or extend `MemoryPublisher`) — fake that records exec calls for testing
9. **Update `cli.ts`** — use `resolvePublisher()` as default, skip OIDC token provider when CLI adapter is used
10. **Add tests for `NpmCliPublisher`** — verify correct args, env, cwd are passed
11. **Add tests for `resolvePublisher()`** — verify version detection and fallback
12. **Update README** — document the new behavior

## Testing Strategy

- `NpmCliPublisher` tests use a fake exec function (injected, similar to how `OidcTokenProvider` accepts `fetchFn`)
- `resolvePublisher()` tests mock the exec call to return different npm versions
- Integration: the `module.spec.ts` tests continue working with `MemoryPublisher` unchanged (after interface adaptation)

## Open Questions

- Should we support `--provenance` flag passthrough when using the CLI adapter?
- Should the npm version threshold be configurable?
- Should we warn when falling back to libnpmpublish (since OIDC may not work)?
