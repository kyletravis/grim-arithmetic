import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdout, stderr, argv, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

const newVersion = argv[2];

if (!newVersion) {
  stderr.write('Error: version argument is required.\n');
  stderr.write('Usage: node scripts/bump-version.mjs <version>\n');
  stderr.write('Example: node scripts/bump-version.mjs 0.7.3-rc1\n');
  exit(1);
}

if (!VERSION_RE.test(newVersion)) {
  stderr.write(`Error: invalid version "${newVersion}".\n`);
  stderr.write('Expected format: X.Y.Z or X.Y.Z-<prerelease> (e.g. 0.7.3, 0.7.3-rc1, 1.0.0-beta2)\n');
  exit(1);
}

const files = {
  packageJson: join(root, 'package.json'),
  packageLock: join(root, 'package-lock.json'),
  moduleJson: join(root, 'module.json'),
};

for (const [name, filePath] of Object.entries(files)) {
  if (!existsSync(filePath)) {
    stderr.write(`Error: required file not found (${name}): ${filePath}\n`);
    exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Read and parse all files first so a parse failure leaves nothing mutated.
const pkg = readJson(files.packageJson);
const lock = readJson(files.packageLock);
const mod = readJson(files.moduleJson);

const oldPkgVersion = pkg.version;
const oldLockVersion = lock.version;
const oldModVersion = mod.version;
const downloadUrl = `https://github.com/kyletravis/grim-arithmetic/releases/download/v${newVersion}/grim-arithmetic-v${newVersion}.zip`;

pkg.version = newVersion;
lock.version = newVersion;
lock.packages[''].version = newVersion;
mod.version = newVersion;
mod.download = downloadUrl;

writeJson(files.packageJson, pkg);
writeJson(files.packageLock, lock);
writeJson(files.moduleJson, mod);

stdout.write(`package.json:       ${oldPkgVersion} → ${newVersion}\n`);
stdout.write(`package-lock.json:  ${oldLockVersion} → ${newVersion}\n`);
stdout.write(`module.json:        ${oldModVersion} → ${newVersion}\n`);
stdout.write(`  download: ${downloadUrl}\n`);
