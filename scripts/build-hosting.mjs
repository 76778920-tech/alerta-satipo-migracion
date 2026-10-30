import { mkdir, readdir, copyFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';

// Fresh output is required: never publish leftover files from another build.
const root = process.cwd();
const out = path.join(root, 'dist');
await mkdir(out, { recursive: true });
if ((await readdir(out)).length) throw new Error('dist debe estar vacio antes de preparar el despliegue.');
const allowed = new Set(['.html', '.css', '.js', '.json', '.csv', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2']);
let count = 0;
async function copy(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error('No se publican enlaces simbolicos.');
  if (info.isDirectory()) {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.includes('.local.')) continue;
      await copy(path.join(source, entry.name), path.join(destination, entry.name));
    }
  } else if (allowed.has(path.extname(source))) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    count++;
  }
}
for (const dir of ['web', 'mobile', 'shared']) {
  await copy(path.join(root, 'frontend', dir), path.join(out, dir));
}
for (const entry of await readdir(path.join(root, 'frontend'))) {
  if (entry.endsWith('.html')) await copy(path.join(root, 'frontend', entry), path.join(out, entry));
}
await copy(path.join(root, 'data'), path.join(out, 'data'));
await copy(path.join(root, 'docs', 'wireframes'), path.join(out, 'docs', 'wireframes'));
await mkdir(path.join(out, 'config'), { recursive: true });
await writeFile(path.join(out, 'config', 'public.json'), JSON.stringify({ mode: 'demo' }) + '\n');
console.log(`Despliegue local preparado: ${count + 1} archivos publicos en dist.`);
