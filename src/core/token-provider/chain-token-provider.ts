import type { ITokenProvider } from './types';

export class ChainTokenProvider implements ITokenProvider {
    private providers: ITokenProvider[];

    constructor(providers: ITokenProvider[]) {
        this.providers = providers;
    }

    async getToken(packageName: string, registry: string): Promise<string | undefined> {
        for (let i = 0; i < this.providers.length; i++) {
            const token = await this.providers[i].getToken(packageName, registry);
            if (token) {
                return token;
            }
        }

        return undefined;
    }
}
