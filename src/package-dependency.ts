/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from 'hapic';
import semver from 'semver';
import type { Package } from './core/index.ts';

export function updatePackagesDependencies(packages: Package[]) {
    const pkgDir : Record<string, Package> = {};

    for (const package_ of packages) {
        pkgDir[package_.content.name] = package_;
    }

    for (const pkg of packages) {

        if (pkg.content.dependencies) {
            updatePackageDependenciesByType(pkg, 'dependencies', pkgDir);
        }

        if (pkg.content.devDependencies) {
            updatePackageDependenciesByType(pkg, 'devDependencies', pkgDir);
        }

        if (pkg.content.peerDependencies) {
            updatePackageDependenciesByType(pkg, 'peerDependencies', pkgDir);
        }
    }
}

function isDependencyWorkspaceProtocolValue(value: string) {
    return value.substring(0, 10) === 'workspace:';
}

function normalizeDependencyVersionValue(input: string, pkgVersion: string) : string {
    if (input.length === 1) {
        if (input === '~' || input === '^') {
            return input + pkgVersion;
        }

        return pkgVersion;
    }

    const firstCharacter = input.substring(0, 1);
    if (
        firstCharacter === '*' ||
        firstCharacter === '~' ||
        firstCharacter === '^'
    ) {
        if (semver.valid(input.substring(1))) {
            if (firstCharacter === '~' || firstCharacter === '^') {
                return firstCharacter + pkgVersion;
            }

            return pkgVersion;
        }

        return pkgVersion;
    }

    return pkgVersion;
}

function updatePackageDependenciesByType(
    pkg: Package,
    depType: 'dependencies' | 'devDependencies' | 'peerDependencies',
    pkgDir: Record<string, Package>,
) {
    const dependencies = pkg.content[depType];
    if (!dependencies) {
        return;
    }

    const keys = Object.keys(dependencies);
    for (const key of keys) {
        if (!hasOwnProperty(pkgDir, key)) {
            continue;
        }

        const depPkg = pkgDir[key];
        if (!depPkg) {
            continue;
        }

        const value = dependencies[key];
        if (!value || !isDependencyWorkspaceProtocolValue(value)) {
            continue;
        }

        dependencies[key] = normalizeDependencyVersionValue(value.substring(10), depPkg.content.version);
        pkg.modified = true;
    }
}
