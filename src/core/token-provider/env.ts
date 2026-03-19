/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ITokenProvider } from './types.ts';

export class EnvTokenProvider implements ITokenProvider {
    async getToken(_packageName: string, _registry: string): Promise<string | undefined> {
        return process.env.NODE_AUTH_TOKEN || undefined;
    }
}
