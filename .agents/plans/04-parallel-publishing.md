# Plan: Parallel Publishing with Concurrency Control

## Motivation

Packages are published sequentially in `module.ts:128-131`. For workspaces with many packages (10+), this creates a significant bottleneck in CI/CD pipelines. Each `npm publish` call involves network I/O (registry upload), so parallelism offers near-linear speedup.

## Current Behavior

```typescript
for (let i = 0; i < unpublishedPackages.length; i++) {
    const { pkg: p, token } = unpublishedPackages[i];
    p.published = await publishPackage(p, publisher, { token, registry });
}
```

Publishing 10 packages at ~5 seconds each = ~50 seconds total.

## Proposed Design

### Concurrency-limited parallel publishing

Use a concurrency limiter to publish multiple packages simultaneously while being respectful of registry rate limits.

```typescript
async function publishWithConcurrency(
    packages: Array<{ pkg: Package; token?: string }>,
    publisher: IPackagePublisher,
    registry: string,
    concurrency: number,
): Promise<void> {
    const queue = [...packages];
    const active: Promise<void>[] = [];

    while (queue.length > 0 || active.length > 0) {
        while (active.length < concurrency && queue.length > 0) {
            const item = queue.shift()!;
            const promise = (async () => {
                item.pkg.published = await publishPackage(
                    item.pkg, publisher, { token: item.token, registry },
                );
            })();
            active.push(promise);
        }
        await Promise.race(active);
        // remove settled promises
        // ...
    }
}
```

### CLI flag

Add `--concurrency <n>` flag (default: 4, max: 16):

```
workspaces-publish [--concurrency <n>]
```

Sequential behavior preserved with `--concurrency 1`.

### PublishOptions extension

```typescript
type PublishOptions = {
    // ... existing fields ...
    concurrency?: number; // default: 4
};
```

## Considerations

- **OIDC token caching**: `OidcTokenProvider` already caches per package, so parallel token resolution is safe (assuming cache-key fix from Plan 02 is applied)
- **Registry rate limits**: Default concurrency of 4 balances speed with registry friendliness
- **Error handling**: Use `Promise.allSettled()` semantics — one package failure shouldn't block others. Collect errors and report at the end.
- **Dependency ordering**: Workspace packages may depend on each other. If package A depends on package B, B should be published first. However, since we only publish packages whose versions aren't on the registry yet, and workspace dependencies reference specific versions, ordering is not strictly required. The registry will accept the package even if its dependency isn't published yet.
- **Logging**: With parallel publishing, log output may interleave. Consider prefixing log lines with the package name.

## Implementation Steps

1. Add `concurrency` field to `PublishOptions` type
2. Add `--concurrency` CLI flag in `cli.ts`
3. Implement concurrency-limited publisher loop in `module.ts`
4. Add error aggregation — collect and report all failures
5. Add tests with `MemoryPublisher` verifying parallel execution and error handling

## Testing Strategy

- **Concurrency respected**: Track publish call timing with `MemoryPublisher` — assert no more than N concurrent calls
- **Error isolation**: One package fails, others succeed — assert partial results
- **Sequential fallback**: `concurrency: 1` produces identical behavior to current implementation
- **All fail**: Every publish throws — assert all errors reported
