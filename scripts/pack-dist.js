#!/usr/bin/env node
import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const outFile = path.resolve(rootDir, `${pkg.name}-${pkg.version}.zip`);

execSync(
  `powershell -Command "Compress-Archive -Path 'build','node_modules','LICENSE','README.md','package.json' -DestinationPath '${outFile}' -Force"`,
  {stdio: 'inherit', cwd: rootDir},
);
