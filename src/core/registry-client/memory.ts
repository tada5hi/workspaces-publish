/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
