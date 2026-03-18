/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import type { IFileSystem } from './types';

export class MemoryFileSystem implements IFileSystem {
    private files: Map<string, string>;

    constructor(files?: Record<string, string>) {
        this.files = new Map(
            Object.entries(files ?? {}).map(([k, v]) => [this.normalize(k), v]),
        );
    }

    async readFile(filePath: string): Promise<string> {
        const normalized = this.normalize(filePath);
        const content = this.files.get(normalized);
        if (content === undefined) {
            throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        }
        return content;
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        this.files.set(this.normalize(filePath), content);
    }

    async glob(
        patterns: string[],
        options: { cwd?: string; ignore?: string[] } = {},
    ): Promise<string[]> {
        const cwd = options.cwd ? this.normalize(options.cwd) : '';
        const dirs = new Set<string>();
        const keys = Array.from(this.files.keys());

        for (let k = 0; k < keys.length; k++) {
            const key = keys[k];

            if (cwd && !key.startsWith(`${cwd}/`) && key !== cwd) {
                continue;
            }

            const relative = cwd ? key.slice(cwd.length + 1) : key;
            const parts = relative.split('/');

            for (let p = 0; p < patterns.length; p++) {
                if (this.matchGlobPattern(parts, patterns[p])) {
                    const dir = parts.slice(0, patterns[p].split('/').length)
                        .join('/');
                    const absolute = cwd ? `${cwd}/${dir}` : dir;
                    dirs.add(absolute);
                }
            }
        }

        return Array.from(dirs);
    }

    getFile(filePath: string): string | undefined {
        return this.files.get(this.normalize(filePath));
    }

    private normalize(filePath: string): string {
        return path.posix.normalize(filePath.replace(/\\/g, '/'));
    }

    private matchGlobPattern(parts: string[], pattern: string): boolean {
        const patternParts = pattern.split('/');

        for (let i = 0; i < patternParts.length; i++) {
            if (i >= parts.length) return false;

            const pp = patternParts[i];
            if (pp === '*' || pp === '**') continue;
            if (pp !== parts[i]) return false;
        }

        return true;
    }
}
