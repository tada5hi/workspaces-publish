export type PackageJson = {
    name: string;

    private?: boolean,

    version: string;

    publishConfig?: Record<string, any>,

    workspaces?: string[]
};

export type Package = {
    path: string;
    content: PackageJson,
    published?: boolean
};

export type PackagePublishOptions = {
    token: string,
    registry: string,
};

export type PackumentVersion = {
    name: string,
    version: string
};

export type Packument = {
    name: string,
    'dist-tags' : Record<string, string>,
    versions: Record<string, PackumentVersion>
};

export type PublishContext = {
    cwd?: string,
    rootPackage?: boolean,
    registry?: string,
    token?: string
};
