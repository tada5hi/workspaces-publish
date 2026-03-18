# Testing

## Test Framework

The project uses **Vitest** (v4.x) with **SWC** for TypeScript compilation.

## Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage
```

## Configuration

Test configuration is in `test/vitest.config.ts`. Tests are located in `test/unit/` and follow the `*.spec.ts` naming convention.

## Test Structure

```
test/
├── unit/
│   ├── module.spec.ts              # Publish orchestrator (9 tests)
│   ├── package.spec.ts             # Package logic (11 tests)
│   ├── package-dependency.spec.ts  # Workspace dep resolution (7 tests)
│   ├── oidc-token-provider.spec.ts # OIDC flow (8 tests)
│   ├── chain-token-provider.spec.ts # Chain fallback (4 tests)
│   └── token-provider.spec.ts      # Static/Env/Memory providers (7 tests)
├── data/                           # Test fixture data
│   ├── package.json                # Mock monorepo root
│   └── packages/
│       ├── pkgA/package.json
│       ├── pkgB/package.json
│       └── pkgC/package.json
└── vitest.config.ts
```

## Test Fixtures

The `test/data/` directory contains a mock monorepo structure:

- **pkgA** — Depends on pkgB via `workspace:^` protocol
- **pkgB** — Standalone private package
- **pkgC** — Depends on pkgB via `workspace:~` and has a peer dependency on pkgA

These are used as reference, but most tests use `MemoryFileSystem` with virtual files instead.

## Testing Approach: Memory Adapters (No Mocks)

Tests use **injected memory/fake adapters** instead of `vi.mock`. This is a core architectural principle:

```typescript
import {
    MemoryFileSystem, MemoryPublisher,
    MemoryRegistryClient, MemoryTokenProvider, NoopLogger,
} from '../../src/core';

const packages = await publish({
    cwd: '/project',
    fileSystem: new MemoryFileSystem({ '/project/package.json': '...' }),
    registryClient: new MemoryRegistryClient(),
    publisher: new MemoryPublisher(),
    tokenProvider: new MemoryTokenProvider('test-token'),
    logger: new NoopLogger(),
});
```

**Do NOT use `vi.mock`** — all external I/O is behind port interfaces with memory implementations.

### Available Memory Adapters

| Adapter                | What it fakes                     | Test utility                           |
|------------------------|-----------------------------------|----------------------------------------|
| `MemoryFileSystem`     | File reads, writes, glob          | Constructor accepts `Record<path, content>` |
| `MemoryRegistryClient` | Registry packument queries        | Constructor accepts `Record<name, Packument>` |
| `MemoryPublisher`      | Pack and publish                  | `.published` array records all publish calls |
| `MemoryTokenProvider`  | Token resolution                  | Constructor accepts optional token string |
| `NoopLogger`           | Logging output                    | All methods are no-ops                  |

### Testing OIDC

`OidcTokenProvider` accepts a `fetchFn` constructor parameter for injecting a fake HTTP function:

```typescript
const { fetchFn, calls } = createFakeFetch([
    { ok: true, status: 200, body: { value: 'oidc-token' } },
    { ok: true, status: 201, body: { token: 'npm-token' } },
]);

const provider = new OidcTokenProvider({
    requestUrl: 'https://actions.github.com/oidc/token?v=1',
    requestToken: 'bearer',
    fetchFn,
});
```

## Coverage

Coverage reports are generated with `@vitest/coverage-v8`. Current coverage: 46 tests across 6 files.

Areas covered:
- Full publish pipeline (publish, skip, private, dryRun, workspace deps)
- Package publishability and version checking
- Workspace protocol resolution (^, ~, *)
- OIDC token flow (fetch, exchange, cache, errors, audience, encoding)
- Token provider chain fallback
- Static, env, and memory token providers
- Tokenless publishing

## Writing New Tests

1. Place test files in `test/unit/` with the `.spec.ts` extension
2. Use memory adapters from `../../src/core` — never `vi.mock`
3. For new ports: create a memory adapter in the corresponding `src/core/<domain>/` folder
4. For HTTP-dependent adapters: accept a `fetchFn` or `execFn` parameter for injectable fakes
5. Run `npm run test` to verify, then `npm run test:coverage` to check coverage
