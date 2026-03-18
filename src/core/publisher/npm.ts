/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import libnpmpack from 'libnpmpack';
import { publish } from 'libnpmpublish';
import type { PackageJson } from '../package/types';
import type { IPackagePublisher } from './types';

export class NpmPublisher implements IPackagePublisher {
    async pack(packagePath: string): Promise<Buffer> {
        return libnpmpack(packagePath);
    }

    async publish(
        manifest: PackageJson,
        tarball: Buffer,
        options: Record<string, any>,
    ): Promise<void> {
        await publish(manifest, tarball, options);
    }
}
