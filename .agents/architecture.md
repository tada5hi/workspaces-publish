# Architecture

## Overview

workspaces-publish follows a straightforward pipeline architecture. The core flow is:

```
CLI / Library API
       │
       ▼
  publish() orchestrator  (module.ts)
       │
       ├─► Read root package.json & discover workspaces  (workspace.ts, package-json.ts)
       │
       ├─► For each workspace package:
       │     ├─► Check publishability (private, version present)  (package.ts)
       │     ├─► Query registry for existing versions             (packument.ts)
       │     ├─► Resolve workspace: protocol dependencies         (package-dependency.ts)
       │     └─► Pack & publish if not already published          (package.ts)
       │
       └─► Return results
```

## Core Design Decisions

### 1. Registry-First Version Check

Before attempting to publish, the tool fetches the **packument** (package metadata document) from the target registry. This allows it to determine whether a specific version already exists, avoiding redundant publish attempts and the errors they produce.

The packument is fetched via `hapic` (an HTTP client), not through npm CLI commands, giving fine-grained control over registry interaction.

### 2. Workspace Protocol Resolution

npm workspaces use `workspace:*` (or `workspace:^`, `workspace:~`) as dependency specifiers. These are not valid for published packages. Before publishing, workspaces-publish rewrites these to the actual resolved version from each dependency's `package.json`.

This happens in `package-dependency.ts` and is critical for correct publishing from monorepos.

### 3. Dual Entry Points

The tool exposes two entry points:

- **CLI** (`cli.ts`): Uses `cac` for argument parsing. Designed for CI/CD usage. Reads token from `--token` flag or `NODE_AUTH_TOKEN` env var.
- **Library** (`index.ts`): Exports the `publish()` function for programmatic use. Consumers can integrate publishing into custom scripts or tools.

Both ultimately call the same `publish()` function in `module.ts`.

### 4. Concurrent Publishing

Packages are published concurrently (not sequentially), improving performance for monorepos with many packages. The publishing logic handles registry-specific version conflict detection to gracefully handle race conditions.

### 5. Version Conflict Detection

Two specialized utilities handle registry-specific conflict responses:

- `is-npm-js-publish-version-conflict.ts` — Detects npmjs.org conflict errors
- `is-npm-pkg-github-version-conflict.ts` — Detects GitHub Packages conflict errors

These allow the tool to treat "already published" as a non-error condition rather than failing the entire run.

## Data Flow

```
Input:
  ├── Root directory (--root flag or cwd)
  ├── Registry URL (--registry flag or default npmjs.org)
  └── Auth token (--token flag or NODE_AUTH_TOKEN)

Processing:
  1. Read root package.json
  2. Resolve workspace glob patterns → list of package directories
  3. Read each workspace's package.json
  4. Filter: skip private packages, packages without versions
  5. For each candidate:
     a. Fetch packument from registry
     b. Compare local version against published versions
     c. If unpublished: rewrite workspace deps → pack → publish
  6. Collect results (success/skip/fail per package)

Output:
  └── Array of publish results
```

## Error Handling

- Registry network errors are propagated to the caller
- Version conflicts (already published) are caught and treated as successful no-ops
- Invalid package configurations (missing name, version) cause the package to be skipped, not the entire run
