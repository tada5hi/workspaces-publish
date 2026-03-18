/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import hapic from 'hapic';
import { REGISTRY_URL } from '../../constants';
import type { IRegistryClient, Packument } from './types';

export class HapicRegistryClient implements IRegistryClient {
    async getPackument(
        name: string,
        options: { registry: string; token?: string },
    ): Promise<Packument> {
        const path = encodeURIComponent(name)
            .replace(/^%40/, '@');

        const headers: Record<string, any> = {
            ACCEPT: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
        };

        if (options.token) {
            headers.AUTHORIZATION = `Bearer ${options.token}`;
        }

        const response = await hapic.get(
            new URL(path, options.registry || REGISTRY_URL).toString(),
            { headers },
        );

        return response.data;
    }
}
