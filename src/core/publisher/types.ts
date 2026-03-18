import type { PackageJson } from '../package/types';

export interface IPackagePublisher {
    pack(packagePath: string): Promise<Buffer>;
    publish(manifest: PackageJson, tarball: Buffer, options: Record<string, any>): Promise<void>;
}
