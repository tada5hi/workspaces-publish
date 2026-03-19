# Plan: Test Coverage Expansion

## Motivation

Several important edge cases and failure modes have no test coverage. Adding these tests increases confidence in the robustness fixes from Plans 01-05 and catches regressions in areas that are currently untested.

## Missing Test Scenarios

### module.spec.ts

| Scenario | What to test |
|----------|-------------|
| Invalid root package.json | `MemoryFileSystem` with malformed JSON at root — assert descriptive error |
| Write failure during dep rewrite | `MemoryFileSystem` that throws on `writeFile()` — assert package skipped |
| `readWorkspacePackages()` partial failures | One workspace package.json is invalid — assert others still processed |
| Empty workspaces array | Root package.json with `"workspaces": []` — assert empty result |

### package.spec.ts

| Scenario | What to test |
|----------|-------------|
| Invalid registry URL | Pass `"not-a-url"` as registry — assert descriptive error |
| Transient registry error (5xx) | `MemoryRegistryClient` that throws with `statusCode: 500` — assert error propagated (not treated as "not published") |

### package-dependency.spec.ts

| Scenario | What to test |
|----------|-------------|
| Missing workspace dependency target | Package references `workspace:^` for non-existent package — assert warning/skip |
| Empty dependency object | Package with `"dependencies": {}` — assert no crash |

### oidc-token-provider.spec.ts

| Scenario | What to test |
|----------|-------------|
| Multi-registry token caching | Same package, different registries — assert separate tokens cached |
| Retry on transient 5xx | `fetchFn` returns 500 then 200 — assert success |
| No retry on 4xx | `fetchFn` returns 403 — assert immediate failure |
| Network error retry | `fetchFn` throws then succeeds — assert recovery |

### npm-cli-publisher.spec.ts

| Scenario | What to test |
|----------|-------------|
| `.npmrc` cleanup on publish error | `execFn` throws — assert `.npmrc` restored/removed |
| `.npmrc` cleanup when write fails | Filesystem write error — assert no orphaned `.npmrc` |

### utils tests (new file: `test/unit/utils.spec.ts`)

| Scenario | What to test |
|----------|-------------|
| `isNpmPkgGitHubPublishVersionConflict` with null message | Error with `undefined` message — assert returns `false` (no crash) |
| `isNpmJsPublishVersionConflict` edge cases | Various error shapes — assert correct detection |

## Implementation Notes

- All tests use memory adapters per project conventions — no `vi.mock`
- For "throwing" memory adapters, extend existing classes or create one-off overrides in test files
- Follow existing test file naming: `test/unit/<module>.spec.ts`
- Run `npm run test:coverage` after to verify improvement

## Priority Order

1. Error handling tests (Plans 01 scenarios) — validates correctness fixes
2. OIDC tests (Plan 02 scenarios) — validates token caching fix
3. Filesystem write tests (Plan 03 scenarios) — validates safety improvements
4. Dependency validation tests (Plan 05 scenarios) — validates new validation logic
