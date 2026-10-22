// Keyless smoke test for the browser half: evaluate the built loader artifact
// with a fake module table and verify it registers one view per tool. Rendering
// needs the full React runtime and slot props, so this checks the wiring only.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let entry
const window = { __ModuleLoader__: { load: (value) => (entry = value) } }
const jsx = (type, props) => ({ type, props })
const fakeRequire = (id) => {
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol.for('react.fragment') }
  throw new Error(`unexpected require: ${id}`)
}

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
new Function('window', 'require', code)(window, fakeRequire)

assert.equal(entry?.id, 'dsh-omarchy-agent', 'client bundle registers under the package name')
const mod = entry.factory(fakeRequire)
assert.deepEqual(mod.inject, ['slots'], 'client plugin injects the slot registry')
assert.equal(typeof mod.apply, 'function', 'client plugin exports apply')

const registered = []
const ctx = {
  slots: {
    inject: (_name, callback) => callback(),
    register: (spec, component) => {
      registered.push({ spec, component })
      return () => {}
    },
  },
}
mod.apply(ctx)

assert.deepEqual(
  registered.map((entry) => entry.spec.key),
  ['omarchy_status', 'omarchy_catalog', 'omarchy_theme', 'omarchy_hypr', 'omarchy_diagnose'],
  'one tool view per Omarchy tool',
)
assert.ok(
  registered.every((entry) => entry.spec.name === 'tool.call.toolview'),
  'every view registers into the tool-call slot',
)
assert.ok(
  registered.every((entry) => typeof entry.component === 'function'),
  'every registration has a component',
)

console.log('client smoke test passed: 5 tool views registered')
