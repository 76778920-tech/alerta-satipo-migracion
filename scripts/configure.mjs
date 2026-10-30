import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('config',{recursive:true});
await writeFile('config/public.json',JSON.stringify({mode:'demo'},null,2)+'\n');
console.log('Modo local configurado.');
