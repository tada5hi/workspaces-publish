export interface ITokenProvider {
    getToken(packageName: string, registry: string): Promise<string | undefined>;
}
