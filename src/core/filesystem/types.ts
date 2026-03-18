export interface IFileSystem {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    glob(patterns: string[], options: { cwd?: string; ignore?: string[] }): Promise<string[]>;
}
