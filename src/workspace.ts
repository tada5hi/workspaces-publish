import consola from 'consola';
import { glob } from 'glob';
import { readPackageJson } from './package-json';
import type { Package } from './types';

export async function readWorkspacePackages(workspace: string | string[], cwd?: string) : Promise<Package[]> {
    const directories = await glob(workspace, {
        ignore: ['node_modules/**'],
        cwd,
        absolute: true,
    });

    const pkgs : Package[] = [];

    for (let i = 0; i < directories.length; i++) {
        const pkg = await readPackageJson(directories[i]);

        if (!pkg.name) {
            consola.info(`${pkg.name} has no version attribute`);
            continue;
        }

        if (pkg.private) {
            consola.info(`${pkg.name} is private and won't be published`);
            continue;
        }

        if (!pkg.version) {
            consola.info(`${pkg.name} has no name attribute`);
            continue;
        }

        pkgs.push({
            path: directories[i],
            content: pkg,
        });
    }

    return pkgs;
}
