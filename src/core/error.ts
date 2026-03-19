/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class BaseError extends Error {
    readonly code: string;

    readonly statusCode: number;

    // ----------------------------------------------------

    constructor(message: string, options: { code: string; statusCode: number }) {
        super(message);
        this.code = options.code;
        this.statusCode = options.statusCode;
    }
}
