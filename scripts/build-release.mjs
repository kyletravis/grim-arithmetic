import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const releaseDir = join(root, 'releases');
const stagingDir = join(releaseDir, `grim-arithmetic-v${version}`);
const zipName = `grim-arithmetic-v${version}.zip`;
const zipPath = join(releaseDir, zipName);

const requiredPaths = [
  'module.json',
  'dist/grim-arithmetic.js',
  'styles/grim-arithmetic.css',
  'templates/danger-board-panel.hbs',
  'templates/pair-detail-panel.hbs',
  'templates/forecast-panel.hbs',
  'README.md',
  'LICENSE',
  'CHANGELOG.md'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) {
    throw new Error(`Missing required release file: ${path}`);
  }
}

rmSync(stagingDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stagingDir, { recursive: true });

execFileSync('rsync', [
  '-a',
  '--exclude', '.DS_Store',
  '--exclude', 'node_modules',
  '--exclude', '.git',
  '--exclude', 'coverage',
  join(root, 'dist'),
  join(root, 'styles'),
  join(root, 'templates'),
  join(root, 'docs'),
  stagingDir
]);

for (const file of ['module.json', 'README.md', 'LICENSE', 'CHANGELOG.md']) {
  copyFileSync(join(root, file), join(stagingDir, file));
}

execFileSync('zip', ['-qr', zipPath, '.'], { cwd: stagingDir });
copyFileSync(join(root, 'module.json'), join(releaseDir, 'module.json'));

stdout.write(`Built ${zipPath}\n`);
stdout.write(`Copied ${join(releaseDir, 'module.json')}\n`);
