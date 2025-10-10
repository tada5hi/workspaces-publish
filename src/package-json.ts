import fs from 'node:fs';
import path from 'node:path';
import type { PackageJson } from './types';

export async function readPackageJson(cwd: string): Promise<PackageJson> {
    const raw = await fs.promises.readFile(
        path.join(cwd, 'package.json'),
        { encoding: 'utf-8' },
    );

    return JSON.parse(raw);
}

export async function writePackageJson(cwd: string, packageJson: PackageJson): Promise<void> {
    return fs.promises.writeFile(
        path.join(cwd, 'package.json'),
        JSON.stringify(packageJson),
        { encoding: 'utf-8' },
    );
}
