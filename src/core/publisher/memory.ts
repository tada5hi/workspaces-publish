/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageJson } from '../package/types';
import type { IPackagePublisher } from './types';

export class MemoryPublisher implements IPackagePublisher {
    public published: Array<{ packagePath: string; manifest: PackageJson; options: Record<string, any> }> = [];

    async publish(
        packagePath: string,
        manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<void> {
        this.published.push({ packagePath, manifest, options });
    }
}
