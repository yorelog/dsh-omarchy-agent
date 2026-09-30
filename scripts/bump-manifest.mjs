// Keep manifest.json's version in sync with package.json during `npm version`.
// npm runs the `version` lifecycle script after it has already bumped
// package.json, so the new version is available here.
import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = new URL('../package.json', import.meta.url)
const manifestPath = new URL('../manifest.json', import.meta.url)

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (manifest.version === pkg.version) {
  process.exit(0)
}

manifest.version = pkg.version
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
