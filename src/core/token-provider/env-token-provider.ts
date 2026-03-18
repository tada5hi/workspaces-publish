import type { ITokenProvider } from './types';

export class EnvTokenProvider implements ITokenProvider {
    async getToken(): Promise<string | undefined> {
        return process.env.NODE_AUTH_TOKEN || undefined;
    }
}
