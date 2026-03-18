/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageJson } from '../package/types';

export interface IPackagePublisher {
    pack(packagePath: string): Promise<Buffer>;
    publish(manifest: PackageJson, tarball: Buffer, options: Record<string, any>): Promise<void>;
}
