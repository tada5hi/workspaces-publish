/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ITokenProvider } from './types.ts';

export class MemoryTokenProvider implements ITokenProvider {
    private readonly token?: string;

    // ----------------------------------------------------

    constructor(token?: string) {
        this.token = token;
    }

    // ----------------------------------------------------

    async getToken(_packageName: string, _registry: string): Promise<string | undefined> {
        return this.token;
    }
}
