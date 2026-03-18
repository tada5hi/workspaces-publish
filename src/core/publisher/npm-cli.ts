/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PackageJson } from '../package/types';
import type { ExecFn, IPackagePublisher } from './types';

const execFileAsync = promisify(execFile);

export class NpmCliPublisher implements IPackagePublisher {
    private execFn: ExecFn;

    constructor(options: { execFn?: ExecFn } = {}) {
        this.execFn = options.execFn || execFileAsync;
    }

    async publish(
        packagePath: string,
        _manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<void> {
        const args = ['publish'];

        const authTokenKey = Object.keys(options).find((k) => k.includes(':_authToken'));
        let registry: string | undefined;
        if (authTokenKey) {
            registry = `https:${authTokenKey.replace('/:_authToken', '')}`;
        }

        if (registry) {
            args.push('--registry', registry);
        }

        if (options.access) {
            args.push('--access', options.access);
        }

        if (options.tag) {
            args.push('--tag', options.tag);
        }

        const env: Record<string, string | undefined> = { ...process.env };
        if (authTokenKey && options[authTokenKey]) {
            env.NODE_AUTH_TOKEN = options[authTokenKey];
        }

        try {
            await this.execFn('npm', args, {
                cwd: packagePath,
                env,
            });
        } catch (e: unknown) {
            throw this.normalizeError(e);
        }
    }

    private normalizeError(e: unknown): Error {
        if (!e || typeof e !== 'object') {
            return new Error('Unknown npm publish error');
        }

        const rec = e as Record<string, unknown>;

        let stderr = '';
        if ('stderr' in e && typeof rec.stderr === 'string') {
            stderr = rec.stderr;
        }

        let message = '';
        if ('message' in e && typeof rec.message === 'string') {
            message = rec.message;
        }

        const combined = `${stderr} ${message}`;

        if (combined.includes('EPUBLISHCONFLICT') ||
            combined.includes('You cannot publish over the previously published versions')) {
            const err = new Error(combined.trim());
            (err as unknown as Record<string, unknown>).code = 'EPUBLISHCONFLICT';
            return err;
        }

        if (combined.includes('Cannot publish over existing version') ||
            combined.includes('409 Conflict')) {
            const err = new Error(combined.trim());
            (err as unknown as Record<string, unknown>).code = 'E409';
            return err;
        }

        if (e instanceof Error) {
            return e;
        }

        return new Error(message || 'Unknown npm publish error');
    }
}
