import { hasOwnProperty } from 'hapic';
import semver from 'semver';
import type { Package } from './types';

export function updatePackagesDependencies(packages: Package[]) {
    const pkgDir : Record<string, Package> = {};

    for (let i = 0; i < packages.length; i++) {
        pkgDir[packages[i].content.name] = packages[i];
    }

    for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];

        if (pkg.content.dependencies) {
            updatePackageDependencies(pkg, 'dependencies', pkgDir);
        }

        if (pkg.content.devDependencies) {
            updatePackageDependencies(pkg, 'devDependencies', pkgDir);
        }

        if (pkg.content.peerDependencies) {
            updatePackageDependencies(pkg, 'peerDependencies', pkgDir);
        }
    }
}

function isWorkspaceProtocolValue(value: string) {
    return value.substring(0, 10) === 'workspace:';
}

function normalizeVersion(input: string, pkgVersion: string) : string {
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

function updatePackageDependencies(
    pkg: Package,
    depType: 'dependencies' | 'devDependencies' | 'peerDependencies',
    pkgDir: Record<string, Package>,
) {
    const dependencies = pkg.content[depType];
    if (!dependencies) {
        return;
    }

    const keys = Object.keys(dependencies);
    for (let i = 0; i < keys.length; i++) {
        if (!hasOwnProperty(pkgDir, keys[i])) {
            continue;
        }

        const depPkg = pkgDir[keys[i]];

        let value = dependencies[keys[i]];

        if (isWorkspaceProtocolValue(value)) {
            value = value.substring(10);

            dependencies[keys[i]] = normalizeVersion(value, depPkg.content.version);
            pkg.modified = true;
        }
    }
}
