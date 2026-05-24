import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
}

describe('release packaging metadata', () => {
  it('keeps npm, Foundry manifest, changelog, and release URLs aligned', () => {
    const packageJson = readJson('package.json');
    const moduleJson = readJson('module.json');
    const version = packageJson.version;

    expect(typeof version).toBe('string');
    expect(moduleJson.version).toBe(version);
    expect(moduleJson.compatibility).toMatchObject({ minimum: '13', verified: '14.363' });
    expect(packageJson.license).toBe('MIT');
    expect(existsSync(join(root, 'LICENSE'))).toBe(true);
    expect(existsSync(join(root, 'CHANGELOG.md'))).toBe(true);
    expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toContain(`## v${version}`);

    expect(moduleJson.url).toBe('https://github.com/kyletravis/grim-arithmetic');
    expect(moduleJson.manifest).toBe(
      'https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json'
    );
    expect(moduleJson.download).toBe(
      `https://github.com/kyletravis/grim-arithmetic/releases/download/v${version}/grim-arithmetic-v${version}.zip`
    );
  });

  it('has a release packaging script for Foundry manifest installs', () => {
    const packageJson = readJson('package.json') as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.package).toBe('node scripts/build-release.mjs');
    expect(existsSync(join(root, 'scripts/build-release.mjs'))).toBe(true);
  });
});
