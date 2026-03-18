/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import consola from 'consola';
import type { ILogger } from './types';

export class ConsolaLogger implements ILogger {
    info(message: string): void {
        consola.info(message);
    }

    success(message: string): void {
        consola.success(message);
    }

    warn(message: string): void {
        consola.warn(message);
    }

    error(message: string): void {
        consola.error(message);
    }
}
