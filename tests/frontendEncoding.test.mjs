import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'v2');
const textExtensions = new Set(['.css', '.html', '.js', '.json']);
const mojibakePatterns = [
  /В·/u,
  /в†/u,
  /РїСЂРѕРєСЂ/u
];

async function listFrontendFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFrontendFiles(fullPath);
    return textExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  }));
  return nested.flat();
}

test('v2 frontend does not contain known mojibake artifacts', async () => {
  const files = await listFrontendFiles(frontendRoot);
  const failures = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (mojibakePatterns.some((pattern) => pattern.test(source))) {
      failures.push(path.relative(projectRoot, file));
    }
  }

  assert.deepEqual(failures, []);
});
