/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ITokenProvider } from './types.ts';

export class ChainTokenProvider implements ITokenProvider {
    private readonly providers: ITokenProvider[];

    // ----------------------------------------------------

    constructor(providers: ITokenProvider[]) {
        this.providers = providers;
    }

    // ----------------------------------------------------

    async getToken(packageName: string, registry: string): Promise<string | undefined> {
        for (const provider of this.providers) {
            const token = await provider.getToken(packageName, registry);
            if (token) {
                return token;
            }
        }

        return undefined;
    }
}
