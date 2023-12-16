import pacote from 'pacote';
import libnpmpublish from 'libnpmpublish';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import libnpmpack from 'libnpmpack';
import type { Package, PackagePublishOptions } from './types';
import { isNpmJsPublishVersionConflict, isNpmPkgGitHubPublishVersionConflict } from './utils';

export async function getUnpublishedPackages(packages: Package[]) {
    const output : Package[] = [];

    for (let i = 0; i < packages.length; i++) {
        const { name, version } = packages[i].content;
        if (!name || !version) {
            continue;
        }

        let exists = true;

        try {
            const { versions } = await pacote.packument(name);
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
    const manifest = await pacote.manifest(pkg.path);
    const tarData = await libnpmpack(pkg.path);

    const publishOptions : Record<string, any> = {};
    if (options.token) {
        const registry = options.registry || 'https://registry.npmjs.org/';
        const url = new URL(registry);

        publishOptions[`//${url.host}/:_authToken`] = options.token;
    }

    try {
        await libnpmpublish.publish(manifest as any, tarData, {
            ...publishOptions,
            ...(pkg.content.publishConfig ? { ...pkg.content.publishConfig } : {}),
        });

        return true;
    } catch (e) {
        if (isNpmJsPublishVersionConflict(e) || isNpmPkgGitHubPublishVersionConflict(e)) {
            return false;
        }

        throw e;
    }
}
