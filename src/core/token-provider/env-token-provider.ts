import type { ITokenProvider } from './types';

export class EnvTokenProvider implements ITokenProvider {
    async getToken(_packageName: string, _registry: string): Promise<string | undefined> {
        return process.env.NODE_AUTH_TOKEN || undefined;
    }
}
