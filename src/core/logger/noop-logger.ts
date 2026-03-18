import type { ILogger } from './types';

export class NoopLogger implements ILogger {
    info(_message: string): void {}

    success(_message: string): void {}

    warn(_message: string): void {}

    error(_message: string): void {}
}
