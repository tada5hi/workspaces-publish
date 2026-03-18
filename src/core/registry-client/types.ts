export type PackumentVersion = {
    name: string,
    version: string
};

export type Packument = {
    name: string,
    'dist-tags' : Record<string, string>,
    versions: Record<string, PackumentVersion>
};

export interface IRegistryClient {
    getPackument(name: string, options: { registry: string; token?: string }): Promise<Packument>;
}
