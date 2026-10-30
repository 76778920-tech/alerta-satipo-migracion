import { build } from 'esbuild';
await build({entryPoints:{backend:'frontend/src/bootstrap/backend.mjs',data:'frontend/src/bootstrap/data.mjs'},bundle:true,format:'iife',platform:'browser',outdir:'frontend/shared/js'});
console.log('Interfaz local compilada.');
