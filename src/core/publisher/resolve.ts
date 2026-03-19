/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import semver from 'semver';
import { NpmCliPublisher } from './npm-cli.ts';
import { NpmPublisher } from './npm.ts';
import type { ExecFn, IPackagePublisher } from './types.ts';

const execFileAsync = promisify(execFile);

const NPM_MIN_VERSION = '10.0.0';

export async function resolvePublisher(options: { execFn?: ExecFn } = {}): Promise<IPackagePublisher> {
    const execFn = options.execFn || execFileAsync;

    try {
        const { stdout } = await execFn('npm', ['--version'], {
            cwd: process.cwd(),
            env: process.env as Record<string, string | undefined>,
        });
        const version = stdout.trim();
        if (semver.gte(version, NPM_MIN_VERSION)) {
            return new NpmCliPublisher({ execFn });
        }
    } catch {
        // npm not found
    }

    return new NpmPublisher();
}
