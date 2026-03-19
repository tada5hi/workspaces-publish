/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageJson } from '../package/index.ts';
import type { IPackagePublisher } from './types.ts';

export class MemoryPublisher implements IPackagePublisher {
    public published: Array<{ packagePath: string; manifest: PackageJson; options: Record<string, any> }>;

    // ----------------------------------------------------

    constructor() {
        this.published = [];
    }

    // ----------------------------------------------------

    async publish(
        packagePath: string,
        manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<boolean> {
        this.published.push({ packagePath, manifest, options });
        return true;
    }
}
