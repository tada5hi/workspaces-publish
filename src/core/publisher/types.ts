/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageJson } from '../package/types';

export type ExecFn = (
    command: string,
    args: string[],
    options: { cwd: string; env: Record<string, string | undefined> },
) => Promise<{ stdout: string; stderr: string }>;

export interface IPackagePublisher {
    publish(packagePath: string, manifest: PackageJson, options: Record<string, any>): Promise<void>;
}
