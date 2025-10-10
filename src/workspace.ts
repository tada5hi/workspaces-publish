import fg from 'fast-glob';
import path from 'node:path';
import { readPackageJson } from './package-json';
import type { Package } from './types';

export async function readWorkspacePackages(
    workspace: string | string[],
    cwd?: string,
): Promise<Package[]> {
    const directories = await fg(workspace, {
        ignore: ['node_modules/**'],
        cwd,
        absolute: true,
        onlyDirectories: true,
    });

    const pkgs : Package[] = [];

    for (let i = 0; i < directories.length; i++) {
        try {
            const pkg = await readPackageJson(directories[i]);

            pkgs.push({
                path: path.resolve(directories[i]),
                content: pkg,
            });
        } catch (e) {
            // leave this unhandled.
        }
    }

    return pkgs;
}
