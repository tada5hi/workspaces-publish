export type PackageJson = {
    name: string;

    private?: boolean,

    version: string;

    publishConfig?: Record<string, any>,

    workspaces?: string[],

    dependencies?: Record<string, string>,

    peerDependencies?: Record<string, string>,

    devDependencies?: Record<string, string>,
};

export type Package = {
    path: string;
    content: PackageJson,
    published?: boolean,
    publishable?: boolean,
    modified?: boolean
};
