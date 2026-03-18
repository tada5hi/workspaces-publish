# Testing

## Test Framework

The project uses **Vitest** (v4.x) with **SWC** for TypeScript compilation. Tests were recently migrated from Jest.

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
│   ├── module.spec.ts       # Tests for the publish() orchestrator
│   └── packument.spec.ts    # Tests for registry packument fetching
├── data/                    # Test fixture data
│   ├── package.json         # Mock monorepo root
│   └── packages/
│       ├── pkgA/package.json
│       ├── pkgB/package.json
│       └── pkgC/package.json
└── vitest.config.ts
```

## Test Fixtures

The `test/data/` directory contains a mock monorepo structure used by tests:

- **pkgA** — Depends on pkgB via `workspace:^` protocol
- **pkgB** — Standalone private package
- **pkgC** — Depends on pkgB via `workspace:~` and has a peer dependency on pkgA

This fixture exercises workspace dependency resolution and multi-package publishing scenarios.

## Testing Approach

- **Unit tests** mock external dependencies (registry HTTP calls, file system operations) to test logic in isolation
- Tests verify the core publish pipeline: workspace discovery, version checking, dependency resolution, and publish execution
- Version conflict detection utilities are tested against realistic registry error responses

## Coverage

Coverage reports are generated with `@vitest/coverage-v8`. When writing new code, aim for comprehensive test coverage of:

- Happy-path publish flows
- Already-published (version conflict) scenarios
- Edge cases: private packages, missing versions, workspace protocol resolution
- Registry error handling

## Writing New Tests

1. Place test files in `test/unit/` with the `.spec.ts` extension
2. Use the existing fixtures in `test/data/` or extend them as needed
3. Mock external I/O (HTTP requests, file system) — do not make real registry calls
4. Run `npm run test` to verify, then `npm run test:coverage` to check coverage
