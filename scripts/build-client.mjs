// Build the browser half into the artifact format dsh's client module loader
// expects: window.__ModuleLoader__.load({ id, factory }), with React resolved
// through the loader's baseline module table instead of a bundled copy.
import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

const result = await build({
  entryPoints: [fileURLToPath(new URL('src/client/index.tsx', root))],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  logLevel: 'warning',
})

if (result.outputFiles.length !== 1) throw new Error('expected exactly one client bundle')

const code = result.outputFiles[0].text
const wrapped = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  code,
  '\t\treturn module.exports;',
  '\t}',
  '});',
  '',
].join('\n')

await mkdir(new URL('lib/', root), { recursive: true })
await writeFile(new URL('lib/client.js', root), wrapped)
// tsc also emits an ESM copy of the browser source; the loader uses lib/client.js.
await rm(new URL('lib/client/index.js', root), { force: true })
console.log(`built lib/client.js (${Buffer.byteLength(wrapped)} bytes)`)
