// Standalone loopback broker started by the Omarchy bar panel. The dsh web
// client plugin polls it; see ../src/prompt-broker.ts for the protocol.
import { startPromptBroker } from '../lib/prompt-broker.js'

const broker = startPromptBroker()
const ready = await broker.ready
if (!ready) process.exit(1)

const stop = () => {
  broker.close()
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
