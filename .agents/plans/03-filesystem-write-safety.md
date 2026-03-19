# Plan: Filesystem Write Safety

## Motivation

The dependency-rewrite `writeFile()` in `module.ts` has no error handling. If the write fails (permissions, disk full) after determining a package is publishable, the package could be published with stale `workspace:` protocol dependencies. Additionally, `NpmCliPublisher` can leave orphaned `.npmrc` files on certain error paths.

## Issues

### 1. Unhandled write failure during dependency rewrite (`module.ts:115-119`)

```typescript
if (p.modified && !options.dryRun) {
    await fileSystem.writeFile(
        path.posix.join(p.path, 'package.json'),
        JSON.stringify(p.content),
    );
}
```

If `writeFile()` fails, the error propagates and halts publishing. But the package has already been marked for publishing, and the on-disk `package.json` still contains `workspace:` protocol references. If the error is caught elsewhere, publishing proceeds with broken dependencies.

**Fix**: Write the file before marking the package for publish. If the write fails, skip that package and log a warning:

```typescript
if (p.modified && !options.dryRun) {
    try {
        await fileSystem.writeFile(
            path.posix.join(p.path, 'package.json'),
            JSON.stringify(p.content),
        );
    } catch (e) {
        logger.warn(`Failed to write updated package.json for ${p.content.name}: ${(e as Error).message}`);
        continue; // skip publishing this package
    }
}
```

### 2. Orphaned `.npmrc` on error paths (`npm-cli.ts:124-128`)

The `.npmrc` backup/restore logic can leave orphaned files if `writeFile()` for the `.npmrc` succeeds but the publish itself fails in an unexpected way, and the finally block's unlink also fails silently.

**Fix**: Ensure the finally block properly restores or removes `.npmrc` in all cases. Use a structured cleanup pattern:

```typescript
const npmrcPath = path.join(packagePath, '.npmrc');
let existingNpmrc: string | undefined;
let npmrcWritten = false;

try {
    try {
        existingNpmrc = await fs.readFile(npmrcPath, 'utf-8');
    } catch {
        // no existing .npmrc
    }

    await fs.writeFile(npmrcPath, newContent);
    npmrcWritten = true;

    // ... publish ...
} finally {
    if (npmrcWritten) {
        if (existingNpmrc !== undefined) {
            await fs.writeFile(npmrcPath, existingNpmrc);
        } else {
            try { await fs.unlink(npmrcPath); } catch { /* ignore */ }
        }
    }
}
```

## Implementation Steps

1. Reorder `module.ts` to write package.json before adding to the publish list
2. Add try-catch around `writeFile()` with warning log and skip
3. Tighten `.npmrc` cleanup in `NpmCliPublisher` with `npmrcWritten` guard
4. Add tests for write failure scenarios

## Testing Strategy

- **Write failure**: `MemoryFileSystem` that throws on `writeFile()` for a specific path — assert the package is skipped and a warning is logged
- **`.npmrc` cleanup on publish error**: Inject an `execFn` that throws, verify `.npmrc` is restored/removed
- **`.npmrc` cleanup on write error**: Make `.npmrc` write fail, verify no orphaned file
