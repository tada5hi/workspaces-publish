# Plan: OIDC Token Provider Hardening

## Motivation

The OIDC token provider has two correctness issues: the token cache keys on package name only (ignoring registry), and transient HTTP failures immediately fail the entire publish with no retry. In CI/CD environments where OIDC is the primary auth mechanism, these issues can cause publish failures that are difficult to diagnose.

## Issues

### 1. Cache key should include registry (`oidc.ts:35`)

The token cache uses `packageName` as the sole key:

```typescript
const cached = this.tokenCache.get(packageName);
```

If a package is published to both npmjs.org and GitHub Packages in the same run, the second registry incorrectly reuses the first registry's token. OIDC tokens are registry-scoped, so this would cause an auth failure.

**Fix**: Use `${packageName}@${registry}` as the cache key:

```typescript
const cacheKey = `${packageName}@${registry}`;
const cached = this.tokenCache.get(cacheKey);
// ...
this.tokenCache.set(cacheKey, token);
```

### 2. Retry transient OIDC failures (`oidc.ts:50,75`)

Both the GitHub OIDC token fetch and the npm token exchange throw immediately on non-OK responses. A single transient 5xx from GitHub's OIDC endpoint fails the entire publish.

**Fix**: Add retry logic (1-2 retries with short backoff) for 5xx and network errors:

```typescript
async function fetchWithRetry(
    fetchFn: FetchFn,
    url: string,
    options: RequestInit,
    maxRetries: number = 2,
): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchFn(url, options);
            if (response.ok || response.status < 500) {
                return response;
            }
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            return response;
        } catch (e) {
            if (attempt >= maxRetries) throw e;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    throw new Error('Unreachable');
}
```

Only retry on 5xx and network errors. 4xx errors (auth failures, bad requests) should fail immediately.

## Implementation Steps

1. Change cache key in `OidcTokenProvider` to include registry
2. Add `fetchWithRetry` helper (private method or utility)
3. Use `fetchWithRetry` for both OIDC token fetch and npm exchange calls
4. Add tests for multi-registry caching
5. Add tests for retry behavior (transient 5xx succeeds on retry, 4xx fails immediately)

## Testing Strategy

All tests use the injectable `fetchFn`:

- **Multi-registry cache**: Call `getToken('pkg', 'https://registry.npmjs.org/')` then `getToken('pkg', 'https://npm.pkg.github.com/')` — assert two separate exchange calls with different audiences
- **Retry on 5xx**: `fetchFn` returns 500 on first call, 200 on second — assert success
- **No retry on 4xx**: `fetchFn` returns 403 — assert immediate failure with no retry
- **Network error retry**: `fetchFn` throws on first call, succeeds on second — assert success
- **Max retries exhausted**: `fetchFn` always returns 500 — assert failure after configured retries
