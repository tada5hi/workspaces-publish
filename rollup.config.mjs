/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import resolve from '@rollup/plugin-node-resolve';
import swc from "@rollup/plugin-swc";
import pkg from './package.json' with {type: 'json'};

const extensions = [
    '.js', '.jsx', '.ts', '.tsx',
]

export default [
    {
        input: './src/index.ts',
        external: [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
        ],
        plugins: [
            // Allows node_modules resolution
            resolve({ extensions}),

            // Compile TypeScript/JavaScript files
            swc()
        ],
        output: [
            {
                file: pkg.module,
                format: 'esm',
                sourcemap: true,
            }
        ]
    },
    {
        input: './src/cli.ts',
        external: [
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
        ],
        plugins: [
            // Allows node_modules resolution
            resolve({ extensions}),

            // Compile TypeScript/JavaScript files
            swc({
                swc: {
                    jsc: {
                        target: 'es2022'
                    }
                }
            })
        ],
        output: [
            {
                file: pkg.bin['workspaces-publish'],
                format: 'esm'
            }
        ]
    }
];
