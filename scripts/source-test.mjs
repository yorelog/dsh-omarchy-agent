// Keyless test for the read-only Omarchy source search: fixtures live in a
// temporary tree, so no installed Omarchy is required.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { searchSource } from '../lib/source.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-omarchy-source-'))

try {
  await mkdir(join(root, 'docs', 'sub'), { recursive: true })
  await mkdir(join(root, 'shell', 'Ui'), { recursive: true })
  await mkdir(join(root, 'agents', 'skills'), { recursive: true })
  await mkdir(join(root, 'node_modules', 'skip'), { recursive: true })

  await writeFile(
    join(root, 'docs', 'bar.md'),
    ['# Bar', 'Use BarIconButton from qs.Ui.', 'The harness mark is drawn with Canvas.', '', '## Details', 'Read the shell docs.'].join(
      '\n',
    ),
  )
  await writeFile(join(root, 'docs', 'sub', 'other.txt'), 'Another BarIconButton mention.\n')
  await writeFile(join(root, 'shell', 'Ui', 'BarIconButton.qml'), 'import QtQuick\n// BarIconButton draws the mark\nItem { }\n')
  await writeFile(join(root, 'shell', 'Ui', 'PanelHero.qml'), 'Item { }\n')
  await writeFile(join(root, 'agents', 'skills', 'shell-dev.md'), '# Shell dev\nUse content for KeyboardPanel.\n')
  await writeFile(join(root, 'node_modules', 'skip', 'README.md'), 'BarIconButton should stay hidden.\n')

  const byQuery = await searchSource({ root, query: 'BARICONBUTTON' })
  assert.deepEqual(byQuery.errors, [], 'query search should not error')
  assert.ok(
    byQuery.matches.some((match) => match.file === 'docs/bar.md' && match.line === 2),
    'case-insensitive match in docs/bar.md',
  )
  assert.ok(
    byQuery.matches.some((match) => match.file === 'shell/Ui/BarIconButton.qml' && match.line === 2),
    'match in shell source',
  )
  assert.ok(
    byQuery.matches.every((match) => !match.file.startsWith('node_modules/')),
    'node_modules is skipped',
  )

  const scoped = await searchSource({ root, path: 'docs', query: 'canvas', context: 0 })
  assert.equal(scoped.matches.length, 1, 'path scopes the search')
  assert.equal(scoped.matches[0]?.file, 'docs/bar.md')
  assert.equal(scoped.matches[0]?.line, 3)
  assert.equal(scoped.matches[0]?.excerpt, '3: The harness mark is drawn with Canvas.')

  const byName = await searchSource({ root, query: 'panelhero' })
  assert.ok(
    byName.matches.some((match) => match.file === 'shell/Ui/PanelHero.qml' && match.line === 1),
    'a matching file name is returned even when its body has no match',
  )

  const listed = await searchSource({ root, glob: '*.md' })
  assert.deepEqual(listed.errors, [])
  const listedPaths = listed.files.map((file) => file.path)
  assert.ok(listedPaths.includes('docs/bar.md'), 'file listing includes docs')
  assert.ok(listedPaths.includes('agents/skills/shell-dev.md'), 'file listing includes skills')
  assert.ok(listedPaths.every((path) => !path.startsWith('node_modules/')), 'listing skips node_modules')

  const escaped = await searchSource({ root, path: '../' })
  assert.ok(escaped.errors.length > 0, 'path traversal is rejected')
  assert.deepEqual(escaped.matches, [])

  const missing = await searchSource({ root, path: 'does-not-exist' })
  assert.ok(missing.errors.length > 0, 'missing path is reported')

  const limited = await searchSource({ root, query: 'bariconbutton', limit: 1 })
  assert.equal(limited.matches.length, 1)
  assert.equal(limited.truncated, true)

  console.log('source test passed: query, scope, listing, traversal, limits')
} finally {
  await rm(root, { recursive: true, force: true })
}
