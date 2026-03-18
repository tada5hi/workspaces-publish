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
