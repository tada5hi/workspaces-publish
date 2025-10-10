import { hasOwnProperty } from 'hapic';
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

            const prefix = value.substring(0, 1);

            if (value.length === 1) {
                if (prefix === '*') {
                    dependencies[keys[i]] = depPkg.content.version;
                    pkg.modified = true;
                } else if (prefix === '~' || prefix === '^') {
                    dependencies[keys[i]] = prefix + depPkg.content.version;
                    pkg.modified = true;
                }
            } else {
                value = value.substring(1);

                // todo: respect version by path or explicit version
            }
        }

        /*
        todo: check if it is a plain version
        if (value !== depPkg.content.version) {
            dependencies[keys[i]] = depPkg.content.version;
            pkg.modified = true;
        }
         */
    }
}
