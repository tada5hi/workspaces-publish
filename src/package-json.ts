import fs from 'node:fs';
import path from 'node:path';
import type { PackageJson } from './types';

export async function readPackageJson(cwd: string): Promise<PackageJson> {
    const filePath = path.join(cwd, 'package.json');

    const raw = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    return JSON.parse(raw);
}
