/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { execFile } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { PackageJson } from '../package/types';
import type { ExecFn, IPackagePublisher } from './types';

const execFileAsync = promisify(execFile);

const AUTH_TOKEN_PATTERN = /^(\/\/.+)\/:_authToken$/;

function parseAuthTokenEntry(options: Record<string, any>): { key: string; token: string; registryPath: string } | undefined {
    const keys = Object.keys(options);
    for (let i = 0; i < keys.length; i++) {
        const match = AUTH_TOKEN_PATTERN.exec(keys[i]);
        if (match && options[keys[i]]) {
            return {
                key: keys[i],
                token: options[keys[i]],
                registryPath: match[1],
            };
        }
    }

    return undefined;
}

type ReadFileFn = (filePath: string, encoding: string) => Promise<string>;
type WriteFileFn = (filePath: string, content: string, encoding: string) => Promise<void>;
type UnlinkFn = (filePath: string) => Promise<void>;

type NpmCliPublisherOptions = {
    execFn?: ExecFn;
    readFileFn?: ReadFileFn;
    writeFileFn?: WriteFileFn;
    unlinkFn?: UnlinkFn;
};

export class NpmCliPublisher implements IPackagePublisher {
    private execFn: ExecFn;

    private readFileFn: ReadFileFn;

    private writeFileFn: WriteFileFn;

    private unlinkFn: UnlinkFn;

    constructor(options: NpmCliPublisherOptions = {}) {
        this.execFn = options.execFn || execFileAsync;
        this.readFileFn = options.readFileFn || ((fp, enc) => readFile(fp, enc as BufferEncoding) as Promise<string>);
        this.writeFileFn = options.writeFileFn || ((fp, content, enc) => writeFile(fp, content, enc as BufferEncoding));
        this.unlinkFn = options.unlinkFn || ((fp) => unlink(fp));
    }

    async publish(
        packagePath: string,
        _manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<void> {
        const args = ['publish'];

        const authEntry = parseAuthTokenEntry(options);

        if (options.registry) {
            args.push('--registry', options.registry);
        } else if (authEntry) {
            args.push('--registry', `https:${authEntry.registryPath}`);
        }

        if (options.access) {
            args.push('--access', options.access);
        }

        if (options.tag) {
            args.push('--tag', options.tag);
        }

        const env: Record<string, string | undefined> = { ...process.env };

        let npmrcPath: string | undefined;
        let existingNpmrc: string | undefined;

        if (authEntry) {
            env.NODE_AUTH_TOKEN = authEntry.token;

            const registryUrl = options.registry || `https:${authEntry.registryPath}`;
            const url = new URL(registryUrl);
            const npmrcContent = `//${url.host}/:_authToken=\${NODE_AUTH_TOKEN}\n`;

            npmrcPath = path.join(packagePath, '.npmrc');

            try {
                existingNpmrc = await this.readFileFn(npmrcPath, 'utf-8');
            } catch {
                // no existing .npmrc
            }

            const finalContent = existingNpmrc ?
                `${existingNpmrc.trimEnd()}\n${npmrcContent}` :
                npmrcContent;

            await this.writeFileFn(npmrcPath, finalContent, 'utf-8');
        }

        try {
            await this.execFn('npm', args, {
                cwd: packagePath,
                env,
            });
        } catch (e: unknown) {
            throw this.normalizeError(e);
        } finally {
            if (npmrcPath) {
                if (typeof existingNpmrc === 'string') {
                    await this.writeFileFn(npmrcPath, existingNpmrc, 'utf-8');
                } else {
                    try {
                        await this.unlinkFn(npmrcPath);
                    } catch {
                        // ignore cleanup errors
                    }
                }
            }
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
