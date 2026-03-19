/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError } from '../error.ts';

export class PublishError extends BaseError {
    constructor(message: string, options?: { cause?: Error }) {
        super(message, { code: 'EPUBLISH', statusCode: 500 });

        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}
