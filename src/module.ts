/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import {
    EnvTokenProvider, 
    HapicRegistryClient,
    MemoryTokenProvider, 
    NodeFileSystem, 
    NoopLogger, 
    resolvePublisher,
} from './core/index.ts';
import type {
    IFileSystem, 
    ITokenProvider, 
    Package, 
    PackageJson,
} from './core/index.ts';
import { REGISTRY_URL } from './constants.ts';
import {
    isPackagePublishable, 
    isPackagePublished, 
    publishPackage,
} from './package.ts';
import { isError } from './utils/index.ts';
import { updatePackagesDependencies } from './package-dependency.ts';
import type { PublishOptions } from './types.ts';

function resolveTokenProvider(options: PublishOptions): ITokenProvider {
    if (options.tokenProvider) {
        return options.tokenProvider;
    }

    if (options.token) {
        return new MemoryTokenProvider(options.token);
    }

    return new EnvTokenProvider();
}

async function readWorkspacePackages(
    workspace: string[],
    cwd: string,
    fileSystem: IFileSystem,
): Promise<Package[]> {
    const directories = await fileSystem.glob(workspace, {
        cwd,
        ignore: ['node_modules/**'],
    });

    const pkgs: Package[] = [];

    for (const directory of directories) {
        try {
            const raw = await fileSystem.readFile(
                path.posix.join(directory, 'package.json'),
            );
            const content: PackageJson = JSON.parse(raw);

            pkgs.push({
                path: directory,
                content,
            });
        } catch {
            // leave this unhandled.
        }
    }

    return pkgs;
}

export async function publish(options: PublishOptions = {}): Promise<Package[]> {
    const cwd = options.cwd || process.cwd();
    const registry = options.registry || REGISTRY_URL;
    const rootPackage = options.rootPackage ?? true;

    const fileSystem = options.fileSystem ?? new NodeFileSystem();
    const registryClient = options.registryClient ?? new HapicRegistryClient();
    const publisher = options.publisher ?? await resolvePublisher();
    const tokenProvider = resolveTokenProvider(options);
    const logger = options.logger ?? new NoopLogger();

    const raw = await fileSystem.readFile(path.posix.join(cwd, 'package.json'));
    let pkg: PackageJson;
    try {
        pkg = JSON.parse(raw);
    } catch {
        throw new Error(`Invalid JSON in package.json at ${path.posix.join(cwd, 'package.json')}`);
    }

    const packages: Package[] = [];

    if (
        !Array.isArray(pkg.workspaces) &&
        !rootPackage
    ) {
        return [];
    }

    if (rootPackage) {
        packages.push({
            path: cwd,
            content: pkg,
        });
    }

    if (Array.isArray(pkg.workspaces)) {
        packages.push(...await readWorkspacePackages(pkg.workspaces, cwd, fileSystem));
    }

    updatePackagesDependencies(packages);

    const unpublishedPackages: Array<{ pkg: Package; token?: string }> = [];
    for (const p of packages) {
        if (!isPackagePublishable(p)) {
            continue;
        }

        if (p.valid === false) {
            logger.warn(`Skipping ${p.content.name}: unresolved workspace dependencies`);
            continue;
        }

        const token = await tokenProvider.getToken(p.content.name, registry);
        const published = await isPackagePublished(p, registryClient, { registry, token });
        if (published) {
            continue;
        }

        if (p.modified && !options.dryRun) {
            try {
                await fileSystem.writeFile(
                    path.posix.join(p.path, 'package.json'),
                    JSON.stringify(p.content),
                );
            } catch (e) {
                const message = isError(e) ? e.message : String(e);
                logger.warn(`Failed to write package.json for ${p.content.name}: ${message}`);
                continue;
            }
        }

        unpublishedPackages.push({ pkg: p, token });
    }

    if (unpublishedPackages.length === 0) {
        return [];
    }

    if (options.dryRun) {
        return unpublishedPackages.map((item) => item.pkg);
    }

    for (const { pkg: p, token } of unpublishedPackages) {
        p.published = await publishPackage(p, publisher, {
            token,
            registry,
            tag: options.tag,
        });
    }

    return unpublishedPackages
        .map((item) => item.pkg)
        .filter((p) => !!p.published);
}
