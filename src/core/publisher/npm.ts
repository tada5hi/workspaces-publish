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
    async publish(
        packagePath: string,
        manifest: PackageJson,
        options: Record<string, any>,
    ): Promise<void> {
        const tarball = await libnpmpack(packagePath);
        await publish(manifest, tarball, options);
    }
}
