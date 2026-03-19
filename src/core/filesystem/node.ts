/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import fg from 'fast-glob';
import type { IFileSystem } from './types.ts';

export class NodeFileSystem implements IFileSystem {
    async readFile(filePath: string): Promise<string> {
        return fs.promises.readFile(filePath, { encoding: 'utf-8' });
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        await fs.promises.writeFile(filePath, content, { encoding: 'utf-8' });
    }

    async glob(
        patterns: string[],
        options: { cwd?: string; ignore?: string[] } = {},
    ): Promise<string[]> {
        return fg(patterns, {
            ignore: options.ignore || ['node_modules/**'],
            cwd: options.cwd,
            absolute: true,
            onlyDirectories: true,
        });
    }
}
