/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ITokenProvider } from './types';

export class StaticTokenProvider implements ITokenProvider {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    async getToken(_packageName: string, _registry: string): Promise<string> {
        return this.token;
    }
}
