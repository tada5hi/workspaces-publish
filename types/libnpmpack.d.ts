declare module 'libnpmpack' {
    export interface FetchResult {
        /**
         * A normalized form of the spec passed in as an argument.
         */
        from: string;
        /**
         * The tarball url or file path where the package artifact can be found.
         */
        resolved: string;
        /**
         * The integrity value for the package artifact.
         */
        integrity: string;
    }

    function pack(spec: string, options : Record<string, any> = {}) : Promise<FetchResult & Buffer>;

    export default pack;
}
