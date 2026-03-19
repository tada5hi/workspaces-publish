# Plan: Robust Error Handling & Input Validation

## Motivation

Several code paths crash with unhelpful errors on invalid input. Root `package.json` parse failures, malformed registry URLs, and null error properties all produce raw exceptions instead of actionable messages. These affect both CLI users and CI/CD pipelines where clear error output is critical for debugging.

## Issues

### 1. JSON.parse without try-catch at root package.json (`module.ts:51,76`)

`JSON.parse()` on the root package.json (line 76) is not wrapped in try-catch. Invalid JSON crashes the process with a raw `SyntaxError`. Workspace package.json reads (line 51) are inside a try-catch that silently skips errors, but the root is not protected.

**Fix**: Wrap root `JSON.parse()` in try-catch and throw a descriptive error:

```typescript
let content: PackageJson;
try {
    content = JSON.parse(raw);
} catch (e) {
    throw new Error(`Invalid JSON in root package.json at ${rootPath}: ${(e as Error).message}`);
}
```

### 2. Registry URL validation (`package.ts:58`)

`new URL(registry)` throws a `TypeError` on malformed URLs like `"not-a-url"`. No validation happens at the CLI entry point either.

**Fix**: Validate registry URL in `cli.ts` before passing it to the orchestrator:

```typescript
if (registry) {
    try {
        new URL(registry);
    } catch {
        logger.error(`Invalid registry URL: ${registry}`);
        process.exit(2);
    }
}
```

### 3. Null-safe error inspection (`is-npm-pkg-github-version-conflict.ts:51`)

`ex.message.startsWith(...)` throws if `message` is `undefined`.

**Fix**: Use optional chaining:

```typescript
return ex.message?.startsWith('409 Conflict - PUT https://npm.pkg.github.com') ?? false;
```

### 4. Distinguish transient vs permanent registry errors (`package.ts:25-32`)

The current `catch (e) { return false; }` treats all errors — 404, 500, timeout — as "not published". A temporary registry outage causes incorrect re-publish attempts.

**Fix**: Catch only 404/E404 as "not published"; propagate other errors:

```typescript
try {
    const { versions } = await registryClient.getPackument(name, options);
    if (typeof versions === 'undefined' || typeof versions[version] === 'undefined') {
        return false;
    }
} catch (e: any) {
    if (e?.code === 'E404' || e?.statusCode === 404) {
        return false; // package genuinely doesn't exist
    }
    throw e; // transient error — let caller handle
}
```

## Implementation Steps

1. Add try-catch around root `JSON.parse()` in `module.ts`
2. Add registry URL validation in `cli.ts`
3. Add optional chaining in `is-npm-pkg-github-version-conflict.ts`
4. Refine catch clause in `package.ts` to distinguish error types
5. Add tests for each scenario (invalid JSON, invalid URL, malformed error, transient 500)

## Testing Strategy

All tests use memory adapters:

- **Invalid root JSON**: `MemoryFileSystem` with malformed JSON at root path — assert descriptive error thrown
- **Invalid registry URL**: Unit test for CLI validation logic
- **Null error message**: Pass error with `undefined` message to `isNpmPkgGitHubPublishVersionConflict()`
- **Transient registry error**: `MemoryRegistryClient` that throws a 500-style error — assert it propagates instead of returning `false`