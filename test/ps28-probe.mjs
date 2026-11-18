/**
 * Runtime probe for a specific Photoshop build — no pipeline, no projects.
 *
 *   node test/ps28-probe.mjs [image]
 *
 * What it proves, in order:
 *   1. the host starts and reports its exact version/build and the compat block
 *      from lib/ps-compat.js (`major` / `coldStart` / `retry` / `warmup`);
 *   2. the startup warm-up (assets/ps-warmup.jsx) healed the PS 28 cold-start
 *      race, so the FIRST document operation of this fresh host succeeds;
 *   3. a full person-mask round trip works — open, `autoCutout`, `saveAs` PNG.
 *
 * Run it after a Photoshop update to re-verify a new build instead of trusting
 * the version table. Uses test-results/ for scratch output and quits Photoshop
 * afterwards.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PsSession } from '../lib/ps-session.js'
import { buildPersonMaskJsx } from '../lib/personmask.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(process.argv[2] || path.join(REPO, 'test-results', 'src', 'test-shot.png'))
if (!fs.existsSync(source)) {
  console.error('source image not found:', source)
  console.error('usage: node test/ps28-probe.mjs [image]')
  process.exit(2)
}
const outDir = path.join(REPO, 'test-results', 'tmp')
fs.mkdirSync(outDir, { recursive: true })
const output = path.join(outDir, 'ps-probe-person.png')

const session = new PsSession({
  waitMs: 120000,
  opTimeoutMs: 300000,
  logger: (...args) => console.error('[ps-session]', ...args),
})

let exitCode = 0
try {
  await session.ensure()
  console.log('version  :', session.version || '?')
  console.log('build    :', session.build || '?')
  console.log('warmup   :', session.warmup || '?')

  const state = await session.state()
  console.log('documents:', state.documents)

  // The very first open of this fresh host is the interesting one.
  const mask = buildPersonMaskJsx({ input: source, output })
  const result = await session.runJsx(mask, 300000)
  const bytes = fs.existsSync(output) ? fs.statSync(output).size : 0
  console.log('person mask:', String(result).trim(), '| bytes =', bytes)
  if (!bytes) {
    console.error('person mask was not written')
    exitCode = 1
  }
  console.log(exitCode === 0 ? 'PROBE OK' : 'PROBE FAILED')
} catch (error) {
  console.error('PROBE FAILED:', String(error?.message || error))
  exitCode = 1
} finally {
  try { await session.quit() } catch { /* host already gone */ }
}
process.exit(exitCode)