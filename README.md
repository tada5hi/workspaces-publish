# workspaces-publish 📦

[![npm version](https://badge.fury.io/js/workspaces-publish.svg)](https://badge.fury.io/js/workspaces-publish)
[![Master Workflow](https://github.com/Tada5hi/workspaces-publish/workflows/CI/badge.svg)](https://github.com/Tada5hi/workspaces-publish)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/workspaces-publish/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/workspaces-publish?targetFile=package.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This library facilitates the publication of packages encompassing multiple workspaces as defined in a package.json file.
It determines the unpublished packages by checking each package manifest of the registry,
if one already exists.
## Installation

```bash
npm install workspaces-publish --save
```

## Usage

```bash
npx workspaces-publish \
  --token <token> \
  --registry <registry> \
  --root <root> \
  --rootPackage <rootPackage>
```

### token
- Type: `String`
- Default: `process.env.NODE_AUTH_TOKEN`
- Description: Token for the registry.

### registry
- Type: `String`
- Default: `https://registry.npmjs.org/`
- Description: Registry url.

### root
- Type: `String`
- Default: `process.cwd()`
- Description: Directory where the root package.json is located.

### rootPackage
- Type: `Boolean`
- Default: `true`
- Description: Also consider the root package for publishing.
  Also consider the root package for publishing. The library still 
  checks whether a Name & Version property is set and whether the private property evaluates to false.
