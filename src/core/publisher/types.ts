/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageJson } from '../package/index.ts';

export type ExecFn = (
    command: string,
    args: string[],
    options: { cwd: string; env: Record<string, string | undefined> },
) => Promise<{ stdout: string; stderr: string }>;

export interface IPackagePublisher {
    /**
     * Publish a package to a registry.
     *
     * @param packagePath - Absolute path to the package directory.
     * @param manifest - Parsed package.json contents.
     * @param options - Registry/auth options (e.g. auth token, access level, tag).
     * @returns `true` if published, `false` if the version already exists (conflict).
     * @throws {PublishError} On non-conflict publish failures.
     */
    publish(packagePath: string, manifest: PackageJson, options: Record<string, any>): Promise<boolean>;
}
