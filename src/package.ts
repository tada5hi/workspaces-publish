/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import semver from 'semver';
import type { IPackagePublisher, IRegistryClient, Package } from './core/index.ts';
import { isRegistryError } from './core/index.ts';

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
        if (isRegistryError(e) && e.statusCode === 404) {
            return false;
        }

        throw e;
    }

    return true;
}

export async function publishPackage(
    pkg: Package,
    publisher: IPackagePublisher,
    options: { token?: string; registry: string; tag?: string },
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
        const registryPath = url.pathname.replace(/\/$/, '');

        publishOptions[`//${url.host}${registryPath}/:_authToken`] = options.token;
    }

    const tag = resolveDistTag(pkg, options.tag, publishOptions.tag);
    if (tag) {
        publishOptions.tag = tag;
    }

    return publisher.publish(pkgPath, pkg.content, publishOptions);
}

function resolveDistTag(
    pkg: Package,
    explicitTag: string | undefined,
    publishConfigTag: string | undefined,
): string | undefined {
    if (explicitTag && explicitTag.length > 0) {
        return explicitTag;
    }

    if (publishConfigTag && publishConfigTag.length > 0) {
        return publishConfigTag;
    }

    const prerelease = semver.prerelease(pkg.content.version);
    if (prerelease && prerelease.length > 0 && typeof prerelease[0] === 'string') {
        return prerelease[0];
    }

    return undefined;
}

export function isPackagePublishable(pkg: Package): boolean {
    return !!pkg.content.name &&
        !pkg.content.private &&
        !!pkg.content.version;
}
