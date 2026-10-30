import { mkdir, readdir, copyFile, writeFile, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';

const root = process.cwd();
const out = path.join(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const allowed = new Set(['.html', '.css', '.js', '.json', '.csv', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2']);

async function copy(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error('No se publican enlaces simbolicos.');

  if (info.isDirectory()) {
    const entries = await readdir(source, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => !entry.name.startsWith('.') && !entry.name.includes('.local.'))
      .map(async (entry) => {
        await copy(path.join(source, entry.name), path.join(destination, entry.name));
      }));
    return;
  }

  if (!allowed.has(path.extname(source))) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const staticDirs = ['web', 'mobile', 'shared'];
await Promise.all(staticDirs.map(async (dir) => {
  await copy(path.join(root, 'frontend', dir), path.join(out, dir));
}));

const rootEntries = await readdir(path.join(root, 'frontend'));
await Promise.all(rootEntries
  .filter((entry) => entry.endsWith('.html'))
  .map(async (entry) => {
    await copy(path.join(root, 'frontend', entry), path.join(out, entry));
  }));

await copy(path.join(root, 'data'), path.join(out, 'data'));
await copy(path.join(root, 'docs', 'wireframes'), path.join(out, 'docs', 'wireframes'));
await mkdir(path.join(out, 'config'), { recursive: true });
await writeFile(path.join(out, 'config', 'public.json'), JSON.stringify({ mode: 'demo' }) + '\n');

console.log(`Despliegue local preparado en ${out}.`);
