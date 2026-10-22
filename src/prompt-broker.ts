/**
 * Local prompt broker between the Omarchy bar panel and the dsh web client.
 *
 * The bar panel cannot reach into the browser's composer. It POSTs a prompt
 * here; the dsh web client plugin polls this loopback server and inserts the
 * text into the composer. Nothing is sent to a model. The server is bound to
 * loopback only and caps one prompt at 16 KiB.
 *
 * @module prompt-broker
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

/** Fixed loopback port shared by the panel and the client plugin. */
export const PROMPT_PORT = 3081

const MAX_PROMPT_BYTES = 16 * 1024

/** The live broker handle. */
export interface PromptBroker {
  /** The port that actually bound, or the requested port before `ready`. */
  readonly port: number
  /** Resolves true once listening, false if the port could not be bound. */
  readonly ready: Promise<boolean>
  /** Stop accepting prompts. */
  close(): void
}

interface LatestPrompt {
  id: number
  text: string
}

/**
 * Store one pending prompt for the dsh web client.
 * @param port - loopback port; pass 0 in tests for an OS-assigned port.
 * @returns the broker handle; callers close it on plugin disposal.
 */
export function startPromptBroker(port: number = PROMPT_PORT): PromptBroker {
  let latest: LatestPrompt | null = null
  let sequence = 0
  let boundPort = port
  let closed = false

  const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'POST' && url.pathname === '/prompt') {
      let body = ''
      let tooLarge = false
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => {
        body += chunk
        if (body.length > MAX_PROMPT_BYTES) {
          tooLarge = true
          req.destroy()
        }
      })
      req.on('end', () => {
        if (tooLarge) {
          res.writeHead(413)
          res.end('prompt too large')
          return
        }
        const text = body.trim()
        if (text === '') {
          res.writeHead(400)
          res.end('empty prompt')
          return
        }
        latest = { id: ++sequence, text }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ id: latest.id }))
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/prompt') {
      const after = Number(url.searchParams.get('after') ?? '0')
      const text = latest !== null && latest.id > after ? latest.text : null
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: latest?.id ?? sequence, text }))
      return
    }

    if (req.method === 'GET' && url.pathname === '/ack') {
      const id = Number(url.searchParams.get('id') ?? '0')
      if (latest !== null && latest.id === id) latest = null
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
      return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
      return
    }

    res.writeHead(404)
    res.end('not found')
  })

  const ready = new Promise<boolean>((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      closed = false
      const address = server.address()
      if (typeof address === 'object' && address !== null) boundPort = (address as AddressInfo).port
      resolve(true)
    })
  })

  return {
    get port() {
      return boundPort
    },
    ready,
    close() {
      if (closed) return
      closed = true
      server.close()
    },
  }
}
