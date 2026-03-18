import type { PackageJson } from '../package/types';
import type { IPackagePublisher } from './types';

export class MemoryPublisher implements IPackagePublisher {
    public published: Array<{ manifest: PackageJson; options: Record<string, any> }> = [];

    async pack(_packagePath: string): Promise<Buffer> {
        return Buffer.from('fake-tarball');
    }

    async publish(
        manifest: PackageJson,
        _tarball: Buffer,
        options: Record<string, any>,
    ): Promise<void> {
        this.published.push({ manifest, options });
    }
}
