import { glob } from 'glob';
import { isPackagePublishable } from './package';
import { readPackageJson } from './package-json';
import type { Package } from './types';

export async function readWorkspacePackages(
    workspace: string | string[],
    cwd?: string,
): Promise<Package[]> {
    const directories = await glob(workspace, {
        ignore: ['node_modules/**'],
        cwd,
        absolute: true,
    });

    const pkgs : Package[] = [];

    for (let i = 0; i < directories.length; i++) {
        const pkg = await readPackageJson(directories[i]);

        if (isPackagePublishable(pkg)) {
            pkgs.push({
                path: directories[i],
                content: pkg,
            });
        }
    }

    return pkgs;
}
