# workspaces-publish 📦

[![npm version](https://badge.fury.io/js/workspaces-publish.svg)](https://badge.fury.io/js/workspaces-publish)
[![Master Workflow](https://github.com/Tada5hi/workspaces-publish/workflows/CI/badge.svg)](https://github.com/Tada5hi/workspaces-publish)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/workspaces-publish/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/workspaces-publish?targetFile=package.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This library facilitates the publication of packages encompassing multiple workspaces as defined in a package.json file.
It determines the unpublished packages by checking each package manifest of the registry,
if one already exists.

It is based on the packages 
([libnpmpublish](https://www.npmjs.com/package/libnpmpublish), 
[libnpmpack](https://www.npmjs.com/package/libnpmpack))
that the npm cli uses to publish packages.

**Table of Contents**
- [Installation](#installation)
- [Documentation](#documentation)
- [Usage](#usage)
- [CI](#ci)

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
- Description: Directory where the root package is located.

### rootPackage
- Type: `Boolean`
- Default: `true`
- Description: Also consider the root package for publishing. The library still 
  checks whether a name- & version-property is set and whether the private property evaluates to false.


## CI

### GitHub Action
The library can also be used in combination with [release-please](https://github.com/googleapis/release-please),
as release-please only increases the versions in the monorepo, but does not release the packages.

```yaml
on:
    push:
        branches:
            - main

permissions:
    contents: write
    pull-requests: write

jobs:
    release:
        runs-on: ubuntu-latest
        steps:
            -   uses: google-github-actions/release-please-action@v4
                id: release
                with:
                    token: ${{ secrets.GITHUB_TOKEN }}

            -   name: Checkout
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/checkout@v4

            -   name: Install Node.JS
                if: steps.release.outputs.releases_created == 'true'
                uses: actions/setup-node@v4
                with:
                    node-version: 18
            
            -   name: Install dependencies
                if: steps.release.outputs.releases_created == 'true'
                run: npm ci

            -   name: Publish
                if: steps.release.outputs.releases_created == 'true'
                run: npx workspaces-publish
                env:
                    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
