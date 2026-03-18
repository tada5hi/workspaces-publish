import type { ITokenProvider } from './types';

export class MemoryTokenProvider implements ITokenProvider {
    private token?: string;

    constructor(token?: string) {
        this.token = token;
    }

    async getToken(_packageName: string, _registry: string): Promise<string | undefined> {
        return this.token;
    }
}
