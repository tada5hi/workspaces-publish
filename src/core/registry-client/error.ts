/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../../utils/index.ts';
import { BaseError } from '../error.ts';

export class RegistryError extends BaseError {
    constructor(message: string, statusCode: number) {
        super(message, { code: `E${statusCode}`, statusCode });
    }
}

/**
 * Duck-type check for RegistryError shape.
 *
 * Validates the error has `message` (string), `statusCode` (number),
 * and `code` (string) — matching the BaseError contract.
 *
 * @param input The value to check.
 * @returns `true` if the value has the RegistryError shape.
 */
export function isRegistryError(input: unknown): input is RegistryError {
    return isObject(input) &&
        typeof input.message === 'string' &&
        typeof input.statusCode === 'number' &&
        typeof input.code === 'string';
}
