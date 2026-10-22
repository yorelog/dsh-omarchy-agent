// Broker smoke test: the bar panel POSTs a prompt, the web client polls it,
// then acknowledges it so the same prompt is inserted once.
import assert from 'node:assert/strict'
import { startPromptBroker } from '../lib/prompt-broker.js'

const broker = startPromptBroker(0)
try {
  assert.equal(await broker.ready, true, 'broker should bind a loopback port')
  const base = `http://127.0.0.1:${broker.port}`

  const empty = await (await fetch(`${base}/prompt?after=0`)).json()
  assert.equal(empty.text, null, 'no prompt before the panel posts one')

  const posted = await (await fetch(`${base}/prompt`, { method: 'POST', body: 'hello from the panel' })).json()
  assert.equal(typeof posted.id, 'number', 'post returns a sequence id')

  const received = await (await fetch(`${base}/prompt?after=0`)).json()
  assert.equal(received.text, 'hello from the panel')
  assert.equal(received.id, posted.id)

  await fetch(`${base}/ack?id=${posted.id}`)
  const cleared = await (await fetch(`${base}/prompt?after=0`)).json()
  assert.equal(cleared.text, null, 'ack clears the inserted prompt')

  const health = await (await fetch(`${base}/health`)).json()
  assert.equal(health.ok, true)
  console.log('prompt broker test passed: post, poll, ack')
} finally {
  broker.close()
}
