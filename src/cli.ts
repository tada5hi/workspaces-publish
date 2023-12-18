#!/usr/bin/env node

import { cac } from 'cac';
import consola from 'consola';
import { getUnpublishedPackages, publishPackages } from './package';
import { readPackageJson } from './package-json';
import { readWorkspacePackages } from './workspace';

const cli = cac();

cli
    .command('', 'Publish workspace packages')
    .option('--token <token>', 'Token for registry', {
        default: process.env.NODE_AUTH_TOKEN,
    })
    .option('--registry <registry>', 'Registry url', {
        default: 'https://registry.npmjs.org/',
    })
    .option('--root <root>', 'Root directory', {
        default: process.cwd(),
    })
    .action(async (options: { token: string, registry: string, root: string}) => {
        if (!options.token) {
            consola.error('A token must be provided...');
            process.exit(1);
        }

        const { workspaces } = await readPackageJson(options.root);
        if (!Array.isArray(workspaces)) {
            consola.error('No workspaces defined...');
            process.exit(1);
        }

        let packages = await readWorkspacePackages(workspaces!, options.root);
        packages = await getUnpublishedPackages(packages);
        if (packages.length === 0) {
            consola.info('No packages need to be published.');
        }

        await publishPackages(packages, {
            token: options.token,
            registry: options.registry,
        });

        for (let i = 0; i < packages.length; i++) {
            if (packages[i].published) {
                consola.success(`published ${packages[i].content.name}@${packages[i].content.version}`);
            } else {
                consola.success(`already published ${packages[i].content.name}@${packages[i].content.version}`);
            }
        }

        process.exit(0);
    });

cli.help();

cli.parse();
