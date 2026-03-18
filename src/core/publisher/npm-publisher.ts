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
