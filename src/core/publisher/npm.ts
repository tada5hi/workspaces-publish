/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import libnpmpack from 'libnpmpack';
import { publish } from 'libnpmpublish';
import { isError, isObject } from '../../utils/index.ts';
import type { PackageJson } from '../package/index.ts';
import { PublishError } from './error.ts';
import type { IPackagePublisher } from './types.ts';

export class NpmPublisher implements IPackagePublisher {
    /**
     * Publish a package using libnpmpack + libnpmpublish.
     *
     * @returns `true` if published, `false` if the version already exists.
     * @throws {PublishError} On non-conflict failures (network errors, auth failures, etc.).
     */
    async publish(
        packagePath: string,
        manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<boolean> {
        try {
            const tarball = await libnpmpack(packagePath);
            await publish(manifest, tarball, options);
            return true;
        } catch (e) {
            if (this.isNpmJsVersionConflict(e) || this.isNpmPkgGitHubVersionConflict(e)) {
                return false;
            }

            const cause = isError(e) ? e : undefined;
            const message = cause?.message || 'libnpmpublish failed with an unknown error';
            throw new PublishError(message, { cause });
        }
    }

    // ----------------------------------------------------

    /**
     * Determines whether an exception represents a version conflict
     * when publishing to the npmjs.org registry.
     */
    private isNpmJsVersionConflict(ex: unknown): boolean {
        if (!isObject(ex)) {
            return false;
        }

        if ('code' in ex && ex.code === 'EPUBLISHCONFLICT') {
            return true;
        }

        return 'code' in ex &&
            ex.code === 'E403' &&
            typeof ex.message === 'string' &&
            ex.message.includes('You cannot publish over the previously published versions');
    }

    /**
     * Determines whether an exception represents a version conflict
     * when publishing to GitHub Packages (npm.pkg.github.com).
     */
    private isNpmPkgGitHubVersionConflict(ex: unknown): boolean {
        if (!isObject(ex)) {
            return false;
        }

        if ('code' in ex && ex.code === 'E409') {
            return true;
        }

        if (
            'body' in ex &&
            isObject(ex.body) &&
            ex.body.error === 'Cannot publish over existing version'
        ) {
            return true;
        }

        return typeof ex.message === 'string' &&
            ex.message.startsWith('409 Conflict - PUT https://npm.pkg.github.com');
    }
}
