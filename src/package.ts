/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import type { IPackagePublisher } from './core/publisher/types';
import type { IRegistryClient } from './core/registry-client/types';
import type { Package } from './core/package/types';
import { isNpmJsPublishVersionConflict, isNpmPkgGitHubPublishVersionConflict } from './utils';

export async function isPackagePublished(
    pkg: Package,
    registryClient: IRegistryClient,
    options: { registry: string; token?: string },
): Promise<boolean> {
    const { name, version } = pkg.content;

    if (!name || !version) {
        throw new Error(`Name or version attribute is missing in ${pkg.path}`);
    }

    try {
        const { versions } = await registryClient.getPackument(name, options);
        if (typeof versions === 'undefined' || typeof versions[version] === 'undefined') {
            return false;
        }
    } catch (e) {
        return false;
    }

    return true;
}

export async function publishPackage(
    pkg: Package,
    publisher: IPackagePublisher,
    options: { token?: string; registry: string },
): Promise<boolean> {
    let pkgPath: string;
    if (path.isAbsolute(pkg.path)) {
        pkgPath = pkg.path;
    } else {
        pkgPath = path.resolve(pkg.path);
    }

    const publishOptions: Record<string, any> = {
        ...(pkg.content.publishConfig || {}),
    };

    if (
        options.token &&
        options.token.length > 0
    ) {
        const registry = options.registry || 'https://registry.npmjs.org/';
        const url = new URL(registry);

        publishOptions[`//${url.host}/:_authToken`] = options.token;
    }

    try {
        await publisher.publish(pkgPath, pkg.content, publishOptions);

        return true;
    } catch (e) {
        if (isNpmJsPublishVersionConflict(e) || isNpmPkgGitHubPublishVersionConflict(e)) {
            return false;
        }

        throw e;
    }
}

export function isPackagePublishable(pkg: Package): boolean {
    return !!pkg.content.name &&
        !pkg.content.private &&
        !!pkg.content.version;
}
