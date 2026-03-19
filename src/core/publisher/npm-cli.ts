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
import { isError, isObject } from '../../utils/index.ts';
import type { PackageJson } from '../package/index.ts';
import { PublishError } from './error.ts';
import type { ExecFn, IPackagePublisher } from './types.ts';

const execFileAsync = promisify(execFile);

const AUTH_TOKEN_PATTERN = /^(\/\/.+)\/:_authToken$/;

function parseAuthTokenEntry(options: Record<string, any>): { key: string; token: string; registryPath: string } | undefined {
    const keys = Object.keys(options);
    for (const key of keys) {
        const match = AUTH_TOKEN_PATTERN.exec(key);
        if (match && options[key]) {
            return {
                key,
                token: options[key],
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
    private readonly execFn: ExecFn;

    private readonly readFileFn: ReadFileFn;

    private readonly writeFileFn: WriteFileFn;

    private readonly unlinkFn: UnlinkFn;

    // ----------------------------------------------------

    constructor(options: NpmCliPublisherOptions = {}) {
        this.execFn = options.execFn || execFileAsync;
        this.readFileFn = options.readFileFn || ((fp, enc) => readFile(fp, enc as BufferEncoding) as Promise<string>);
        this.writeFileFn = options.writeFileFn || ((fp, content, enc) => writeFile(fp, content, enc as BufferEncoding));
        this.unlinkFn = options.unlinkFn || ((fp) => unlink(fp));
    }

    // ----------------------------------------------------

    /**
     * Publish a package by shelling out to `npm publish`.
     *
     * Writes a temporary `.npmrc` for auth when a token is present and
     * restores/removes it after the command completes (even on failure).
     *
     * @returns `true` if published, `false` if the version already exists.
     * @throws {PublishError} On non-conflict failures (network errors, auth failures, etc.).
     */
    async publish(
        packagePath: string,
        _manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<boolean> {
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
            const registryPath = url.pathname.replace(/\/$/, '');
            const npmrcContent = `//${url.host}${registryPath}/:_authToken=\${NODE_AUTH_TOKEN}\n`;

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
            return true;
        } catch (e: unknown) {
            if (this.isVersionConflict(e)) {
                return false;
            }

            const cause = isError(e) ? e : undefined;
            const message = cause?.message || 'npm publish failed with an unknown error';
            throw new PublishError(message, { cause });
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

    // ----------------------------------------------------

    private isVersionConflict(e: unknown): boolean {
        if (!isObject(e)) {
            return false;
        }

        let stderr = '';
        if (typeof e.stderr === 'string') {
            stderr = e.stderr;
        }
        const message = isError(e) ? e.message : '';
        const combined = `${stderr} ${message}`;

        return combined.includes('EPUBLISHCONFLICT') ||
            combined.includes('You cannot publish over the previously published versions') ||
            combined.includes('Cannot publish over existing version') ||
            combined.includes('409 Conflict');
    }
}
