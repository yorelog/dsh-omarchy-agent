// Keyless smoke test: verify the plugin registers everything and the guard
// returns the intended decisions, without starting dsh or calling a model.
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

const tools = new Map()
let section
let guard

const ctx = {
  tools: { register: (definition) => (tools.set(definition.name, definition), () => {}) },
  systemPrompt: { section: (value) => ((section = value), () => {}) },
  on: (event, handler) => {
    if (event === 'tools/pre-execute') guard = handler
  },
}

apply(ctx, {
  omarchyBin: 'omarchy',
  protectedPath: '/usr/share/omarchy',
  privilegedTokens: ['sudo', 'pkexec', 'pacman', 'yay', 'paru', 'makepkg'],
  commandTimeoutMs: 15000,
})

assert.deepEqual(
  [...tools.keys()],
  ['omarchy_status', 'omarchy_catalog', 'omarchy_theme', 'omarchy_hypr', 'omarchy_diagnose'],
  'expected the five Omarchy tools',
)
assert.equal(section?.name, 'dsh-omarchy-agent:conventions', 'expected the conventions section')
assert.equal(typeof guard, 'function', 'expected the pre-execute guard')

const allow = async () => ({ kind: 'allow' })
const decide = (exec) => guard(exec, allow)
const bash = (command) => ({ name: 'bash', arguments: { command } })

assert.equal((await decide({ name: 'write', arguments: { path: '/usr/share/omarchy/x' } })).kind, 'deny')
assert.equal((await decide(bash('rm -rf /usr/share/omarchy/themes'))).kind, 'deny')
assert.equal((await decide(bash('echo x > /usr/share/omarchy/x'))).kind, 'deny')
assert.equal((await decide(bash('cat /usr/share/omarchy/default/hypr/*'))).kind, 'allow')
assert.equal((await decide(bash('sudo pacman -Syu'))).kind, 'ask')
assert.equal((await decide(bash('systemctl restart sshd'))).kind, 'ask')
assert.equal((await decide(bash('systemctl --failed'))).kind, 'allow')
assert.equal((await decide(bash('ls -la'))).kind, 'allow')

console.log('smoke test passed: 5 tools, 1 section, guard decisions correct')
