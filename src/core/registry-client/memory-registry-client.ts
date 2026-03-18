import type { IRegistryClient, Packument } from './types';

export class MemoryRegistryClient implements IRegistryClient {
    private packuments: Map<string, Packument>;

    constructor(packuments?: Record<string, Packument>) {
        this.packuments = new Map(Object.entries(packuments ?? {}));
    }

    async getPackument(name: string): Promise<Packument> {
        const packument = this.packuments.get(name);
        if (!packument) {
            throw new Error(`Package not found: ${name}`);
        }
        return packument;
    }

    addPackument(name: string, packument: Packument): void {
        this.packuments.set(name, packument);
    }
}
