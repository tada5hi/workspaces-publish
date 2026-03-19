# Plan: Workspace Dependency Validation

## Motivation

A `workspace:^` dependency referencing a non-existent workspace package is silently skipped in `package-dependency.ts:81`. The raw `workspace:` prefix remains in the published `package.json`, which breaks `npm install` for consumers. This is a silent correctness bug that is difficult to debug downstream.

## Current Behavior

```typescript
// package-dependency.ts:81
if (!hasOwnProperty(pkgDir, keys[i])) {
    continue; // silently skip — workspace: prefix stays in output
}
```

When a package lists `"some-pkg": "workspace:^"` but `some-pkg` doesn't exist in the workspace, the dependency is left as `"workspace:^"` in the resolved output. This invalid version string makes it into the published package.

## Proposed Fix

### Option A: Warn and skip publishing (recommended)

Log a warning and mark the package as not publishable:

```typescript
if (!hasOwnProperty(pkgDir, keys[i])) {
    logger.warn(
        `Package "${pkg.name}" references workspace dependency "${keys[i]}" which does not exist in the workspace. Skipping publish.`,
    );
    return { modified: false, valid: false };
}
```

This requires threading a `valid` flag through the return type, or throwing a specific error that `module.ts` catches to skip the package.

### Option B: Throw an error

Throw a descriptive error that halts processing for that package:

```typescript
if (!hasOwnProperty(pkgDir, keys[i])) {
    throw new Error(
        `Workspace dependency "${keys[i]}" referenced by "${pkg.name}" not found in workspace.`,
    );
}
```

**Recommendation: Option A** — warning + skip is more resilient in CI/CD. A hard error could block publishing of all packages due to one misconfigured dependency.

## Changes Required

1. `package-dependency.ts` — add validation when workspace dependency target is missing
2. `module.ts` — handle the "invalid" signal (skip package, log warning)
3. Pass `ILogger` into dependency resolution, or return a result object with diagnostics

## Testing Strategy

- `MemoryFileSystem` with a package that has `"workspace:^"` dep on a non-existent package
- Assert the package is skipped (not in published output)
- Assert a warning is logged (if using `ILogger`, capture with a test spy logger)
