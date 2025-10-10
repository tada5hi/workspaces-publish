// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import libnpmpack from 'libnpmpack';
import libnpmpublish from 'libnpmpublish';
import path from 'node:path';
import { getPackument } from './packument';
import type { Package, PackagePublishOptions } from './types';
import { isNpmJsPublishVersionConflict, isNpmPkgGitHubPublishVersionConflict } from './utils';

export async function isPackagePublished(pkg: Package, options: Partial<PackagePublishOptions> = {}) : Promise<boolean> {
    const { name, version } = pkg.content;

    if (!name || !version) {
        throw new Error(`Name or version attribute is missing in ${pkg.path}`);
    }

    let exists = true;

    try {
        const { versions } = await getPackument(name, options);
        if (typeof versions === 'undefined' || typeof versions[version] === 'undefined') {
            exists = false;
        }
    } catch (e) {
        exists = false;
    }

    return exists;
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

export function isPackagePublishable(pkg: Package): boolean {
    return !!pkg.content.name &&
        !pkg.content.private &&
        !!pkg.content.version;
}
