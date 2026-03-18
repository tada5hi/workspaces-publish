import type { ILogger } from './types';

export class NoopLogger implements ILogger {
    info(): void {}

    success(): void {}

    warn(): void {}

    error(): void {}
}
