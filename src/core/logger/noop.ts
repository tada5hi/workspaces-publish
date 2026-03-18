/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ILogger } from './types';

export class NoopLogger implements ILogger {
    info(_message: string): void {}

    success(_message: string): void {}

    warn(_message: string): void {}

    error(_message: string): void {}
}
