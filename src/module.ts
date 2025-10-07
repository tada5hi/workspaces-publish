import path from 'node:path';
import { REGISTRY_URL } from './constants';
import {
    isPackagePublishable, isPackagePublished, publishPackages,
} from './package';
import { readPackageJson, writePackageJson } from './package-json';
import type { Package, PublishOptions } from './types';
import { updatePackagesDependencies } from './package-dependency';
import { readWorkspacePackages } from './workspace';

export async function publish(options: PublishOptions = {}) : Promise<Package[]> {
    const token = options.token || process.env.NODE_AUTH_TOKEN;
    if (!token) {
        throw new Error('A token must be provided.');
    }

    const cwd = options.cwd || process.cwd();
    const rootPackage = options.rootPackage ?? true;
    const packages : Package[] = [];

    const pkg = await readPackageJson(cwd);
    if (
        !Array.isArray(pkg.workspaces) &&
        !rootPackage
    ) {
        return [];
    }

    if (rootPackage) {
        packages.push({
            path: path.resolve(cwd),
            content: pkg,
        });
    }

    if (Array.isArray(pkg.workspaces)) {
        packages.push(...await readWorkspacePackages(pkg.workspaces!, cwd));
    }

    updatePackagesDependencies(packages);

    const unpublishedPackages : Package[] = [];
    for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];

        if (!isPackagePublishable(pkg)) {
            continue;
        }

        const isPublished = await isPackagePublished(pkg);
        if (isPublished) {
            continue;
        }

        if (pkg.modified && !options.dryRun) {
            await writePackageJson(pkg.path, pkg.content);
        }

        unpublishedPackages.push(pkg);
    }

    if (unpublishedPackages.length === 0) {
        return [];
    }

    const registry = options.registry || REGISTRY_URL;
    await publishPackages(unpublishedPackages, {
        token,
        registry,
    });

    return unpublishedPackages.filter((pkg) => !!pkg.published);
}
