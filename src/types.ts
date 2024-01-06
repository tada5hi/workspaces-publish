export type PackageJson = {
    name?: string;

    private?: boolean,

    version?: string;

    publishConfig?: Record<string, any>,

    workspaces?: string[]
};

export type Package = {
    path: string;
    content: PackageJson,
    published?: boolean
};

export type PackagePublishOptions = {
    token?: string,
    registry?: string,
};

export type PublishContext = {
    cwd?: string,
    rootPackage?: boolean,
    registry?: string,
    token?: string
};
