# Plan: CLI UX Improvements

## Motivation

The CLI currently has minimal error output, no dry-run summary, and a single exit code for all failure types. These gaps make it harder to debug publish failures in CI/CD logs and to distinguish between "nothing to publish" (success) and "publish failed" (error).

## Improvements

### 1. Better error output (`cli.ts:91`)

Currently only logs `e?.message`, losing stack traces and error context:

```typescript
logger.error(e?.message);
```

**Fix**: In verbose/debug mode, log the full error including stack trace. In normal mode, log the message with error code if available:

```typescript
if (e instanceof Error) {
    logger.error(e.message);
    if (process.env.DEBUG) {
        logger.error(e.stack ?? '');
    }
} else {
    logger.error(String(e));
}
```

### 2. Dry-run summary

When `--dryRun` is used, print what would be published instead of silence:

```
Dry run — the following packages would be published:
  @scope/pkg-a@1.2.0 → https://registry.npmjs.org/
  @scope/pkg-b@0.5.1 → https://registry.npmjs.org/
```

This requires `module.ts` to return candidate packages even in dry-run mode (it already does — they're just not marked as `published`).

### 3. Distinct exit codes

| Exit code | Meaning |
|-----------|---------|
| 0 | Success (packages published or nothing to publish) |
| 1 | Publish error (one or more packages failed) |
| 2 | Invalid input (bad CLI args, invalid registry URL, invalid JSON) |

Currently all failures exit with code 1 (the default for uncaught errors). Add explicit `process.exit(2)` for input validation failures.

### 4. Summary output on success

After publishing, print a concise summary:

```
Published 3 of 5 workspace packages:
  @scope/pkg-a@1.2.0
  @scope/pkg-b@0.5.1
  @scope/pkg-c@2.0.0
Skipped 2 (already published):
  @scope/pkg-d@1.0.0
  @scope/pkg-e@3.1.0
```

## Implementation Steps

1. Add `--debug` or `--verbose` CLI flag for extended error output
2. Add dry-run summary logging after `publish()` returns
3. Add distinct exit codes in `cli.ts` error handling
4. Add success summary logging

## Testing Strategy

CLI UX changes are best verified manually or via integration tests that capture stdout/stderr. Unit tests can verify:
- Exit code logic (mock `process.exit`)
- Summary formatting functions (pure logic, easy to test)
