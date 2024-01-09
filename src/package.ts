// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import libnpmpack from 'libnpmpack';
import libnpmpublish from 'libnpmpublish';
import path from 'node:path';
import { getPackument } from './packument';
import type { Package, PackageJson, PackagePublishOptions } from './types';
import { isNpmJsPublishVersionConflict, isNpmPkgGitHubPublishVersionConflict } from './utils';

export async function getUnpublishedPackages(
    packages: Package[],
    publishOptions: Partial<PackagePublishOptions> = {},
) {
    const output : Package[] = [];

    for (let i = 0; i < packages.length; i++) {
        const { name, version } = packages[i].content;
        if (!name || !version) {
            continue;
        }

        let exists = true;

        try {
            const { versions } = await getPackument(name, publishOptions);
            if (typeof versions === 'undefined' || typeof versions[version] === 'undefined') {
                exists = false;
            }
        } catch (e) {
            exists = false;
        }

        if (!exists) {
            output.push(packages[i]);
        }
    }

    return output;
}

export async function publishPackage(pkg: Package, options: PackagePublishOptions): Promise<boolean> {
    let pkgPath : string;
    if (path.isAbsolute(pkg.path)) {
        pkgPath = pkg.path;
    } else {
        pkgPath = path.resolve(pkg.path);
    }

    const tarData = await libnpmpack(pkgPath);

    const publishOptions : Record<string, any> = {};
    if (options.token) {
        const registry = options.registry || 'https://registry.npmjs.org/';
        const url = new URL(registry);

        publishOptions[`//${url.host}/:_authToken`] = options.token;
    }

    try {
        await libnpmpublish.publish(pkg.content, tarData, {
            ...publishOptions,
            ...(pkg.content.publishConfig ? { ...pkg.content.publishConfig } : {}),
        });

        return true;
    } catch (e) {
        /* istanbul ignore next */
        if (isNpmJsPublishVersionConflict(e) || isNpmPkgGitHubPublishVersionConflict(e)) {
            return false;
        }

        /* istanbul ignore next */
        throw e;
    }
}

export async function publishPackages(pkgs: Package[], options: PackagePublishOptions) : Promise<Package[]> {
    for (let i = 0; i < pkgs.length; i++) {
        pkgs[i].published = await publishPackage(pkgs[i], {
            token: options.token,
            registry: options.registry,
        });
    }

    return pkgs;
}

export function isPackagePublishable(pkg: PackageJson): boolean {
    return !!pkg.name &&
        !pkg.private &&
        !!pkg.version;
}
