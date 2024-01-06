import { getUnpublishedPackages, publishPackages } from './package';
import { readPackageJson } from './package-json';
import type { Package, PublishContext } from './types';
import { readWorkspacePackages } from './workspace';

export async function publish(ctx: PublishContext = {}) : Promise<Package[]> {
    const token = ctx.token || process.env.NODE_AUTH_TOKEN;
    if (!token) {
        throw new Error('A token must be provided.');
    }

    const cwd = ctx.cwd || process.cwd();
    const rootPackage = ctx.rootPackage ?? true;
    let packages : Package[] = [];

    const pkg = await readPackageJson(cwd);
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
        packages.push(...await readWorkspacePackages(pkg.workspaces!, cwd));
    }

    packages = await getUnpublishedPackages(packages);
    if (packages.length === 0) {
        return [];
    }

    const registry = ctx.registry || 'https://registry.npmjs.org/';
    await publishPackages(packages, {
        token,
        registry,
    });

    return packages.filter((pkg) => !!pkg.published);
}
