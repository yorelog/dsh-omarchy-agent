// Keyless smoke test: verify the plugin registers everything and the guard
// returns the intended decisions, without starting dsh or calling a model.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apply } from '../lib/index.js'

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))
assert.deepEqual(manifest.kinds, ['bar-widget'], 'the plugin must not mount a service that installs on load')
assert.equal(manifest.entryPoints.service, undefined, 'no service entry point')

const base = {
  omarchyBin: 'omarchy',
  protectedPath: '/usr/share/omarchy',
  privilegedTokens: [],
  commandTimeoutMs: 15000,
}

function harness(config) {
  const tools = new Map()
  const disposers = []
  let section
  let guard
  const ctx = {
    tools: { register: (definition) => (tools.set(definition.name, definition), () => {}) },
    systemPrompt: { section: (value) => ((section = value), () => {}) },
    effect: (execute) => {
      const dispose = execute()
      if (typeof dispose === 'function') disposers.push(dispose)
      return () => {}
    },
    on: (event, handler) => {
      if (event === 'tools/pre-execute') guard = handler
    },
  }
  apply(ctx, config)
  return { tools, section, guard, disposers }
}

const { tools, section, guard, disposers } = harness(base)
const allow = async () => ({ kind: 'allow' })
const decide = (exec) => guard(exec, allow)
const bash = (command) => ({ name: 'bash', arguments: { command } })

assert.deepEqual(
  [...tools.keys()],
  [
    'omarchy_status',
    'omarchy_catalog',
    'omarchy_theme',
    'omarchy_hypr',
    'omarchy_diagnose',
    'omarchy_source',
    'omarchy_agent',
    'omarchy_plugin',
    'omarchy_shell',
    'omarchy_panel',
  ],
  'expected the ten Omarchy tools',
)
assert.equal(section?.name, 'dsh-omarchy-agent:conventions', 'expected the conventions section')
assert.equal(typeof guard, 'function', 'expected the pre-execute guard')

// The prompt must teach the read-only boundary and the source tool, not just
// repeat that the package tree may be read.
const promptText = section?.text?.() ?? ''
assert.match(promptText, /default agents, not its administrator/, 'prompt should state the default-agent boundary')
assert.match(promptText, /omarchy_source/, 'prompt should route Omarchy source reads through omarchy_source')
assert.match(promptText, /omarchy_agent/, 'prompt should route agent state through omarchy_agent')
assert.match(promptText, /omarchy_plugin/, 'prompt should route plugin inspection through omarchy_plugin')
assert.match(promptText, /omarchy_shell/, 'prompt should route shell inspection through omarchy_shell')
assert.match(promptText, /omarchy_panel/, 'prompt should route panel signals through omarchy_panel')
assert.match(promptText, /read tool/, 'prompt should keep the read tool as the escape hatch')
assert.match(promptText, /omarchy-restart-shell/, 'prompt should include the shell restart step')
assert.match(promptText, /omarchy capture screenshot/, 'prompt should include visual verification')
assert.match(promptText, /hyprctl configerrors/, 'prompt should require configerrors validation after Hyprland edits')
assert.match(promptText, /hl\.unbind/, 'prompt should require unbind before re-binding a key')

// The package-owned tree is never a write target, in every mode.
assert.equal((await decide({ name: 'write', arguments: { path: '/usr/share/omarchy/x' } })).kind, 'deny')
assert.equal((await decide({ name: 'edit', arguments: { file_path: '/usr//share/omarchy/x' } })).kind, 'deny')
assert.equal((await decide(bash('rm -rf /usr/share/omarchy/themes'))).kind, 'deny')
assert.equal((await decide(bash('echo x > /usr/share/omarchy/x'))).kind, 'deny')
assert.equal((await decide(bash('echo x >> /usr/share/omarchy/x'))).kind, 'deny')
assert.equal((await decide(bash('echo x >"/usr/share/omarchy/x"'))).kind, 'deny')
assert.equal((await decide(bash('echo x > $OMARCHY_PATH/x'))).kind, 'deny')
assert.equal((await decide(bash('cat /usr/share/omarchy/default/hypr/*'))).kind, 'allow')
assert.equal((await decide(bash('head -n 40 /usr/share/omarchy/shell/Ui/BarIconButton.qml'))).kind, 'allow')
assert.equal((await decide(bash('rg iconComponent /usr/share/omarchy/shell'))).kind, 'allow')

// `sed` is in the write-hint list, so a read-only `sed -n` is denied. The
// denial must own that and route to a reader the guard allows.
const sedRead = await decide(bash('sed -n 1,130p /usr/share/omarchy/shell/Ui/BarIconButton.qml'))
assert.equal(sedRead.kind, 'deny')
assert.match(sedRead.reason, /contains sed/)
assert.match(sedRead.reason, /read tool/)

// A bare `>` is not a write: stderr redirection, descriptor duplication, and a
// `>` inside a quoted string must all stay readable.
assert.equal((await decide(bash('ls /usr/share/omarchy/themes 2>&1'))).kind, 'allow')
assert.equal((await decide(bash('ls /usr/share/omarchy/themes 2>/dev/null'))).kind, 'allow')
assert.equal((await decide(bash('grep -rn foo /usr/share/omarchy/default 2>&1 | head'))).kind, 'allow')
assert.equal((await decide(bash('printf "a > b"; ls /usr/share/omarchy/themes'))).kind, 'allow')
assert.equal((await decide(bash('echo x > /tmp/out; cat /usr/share/omarchy/x'))).kind, 'allow')

// Gating is opt-in. Omarchy launches dsh with full access, so the default
// bundle must not turn privileged commands into a denial.
assert.equal((await decide(bash('sudo pacman -Syu'))).kind, 'allow')
assert.equal((await decide(bash('omarchy update'))).kind, 'allow')
assert.equal((await decide(bash('systemctl restart sshd'))).kind, 'allow')
assert.equal((await decide(bash('reboot'))).kind, 'allow')

// Opting in restores the approval gate for the listed tokens and the built-in
// privileged/system-mutating/power patterns.
const gated = harness({ ...base, privilegedTokens: ['sudo'] })
const gatedDecide = (exec) => gated.guard(exec, allow)
assert.equal((await gatedDecide(bash('sudo pacman -Syu'))).kind, 'ask')
assert.equal((await gatedDecide(bash('pacman -Syu'))).kind, 'ask')
assert.equal((await gatedDecide(bash('omarchy update'))).kind, 'ask')
assert.equal((await gatedDecide(bash('systemctl restart sshd'))).kind, 'ask')
assert.equal((await gatedDecide(bash('reboot'))).kind, 'ask')
assert.equal((await gatedDecide(bash('systemctl --failed'))).kind, 'allow')
assert.equal((await gatedDecide(bash('ls -la'))).kind, 'allow')
assert.equal((await gatedDecide({ name: 'write', arguments: { path: '/usr/share/omarchy/x' } })).kind, 'deny')

for (const dispose of [...disposers, ...gated.disposers]) dispose()

console.log('smoke test passed: 10 tools, no service, 1 section, guard decisions correct')
