/**
 * Photoshop version compatibility table.
 *
 * The pipeline only uses ExtendScript APIs that have been stable for years, but
 * host behaviour differs subtly between releases. Everything below was measured
 * on real builds by driving `Photoshop.Application` over COM:
 *
 *   PS 28 (2027, build 28.0 / 20261027.r.20) — "cold start race"
 *     The first document/file operation after a fresh host start throws the
 *     generic error
 *       发生了常规 Photoshop 错误。该功能可能无法在这个版本的 Photoshop 中使用。
 *     even for a perfectly valid file, and even for `app.documents.add()`.
 *     The very same call succeeds a moment later (measured: 1 failure, then OK
 *     after ~400ms), so it is a startup race in the document subsystem — NOT a
 *     path/format problem. Proof: forward slashes, native backslashes and
 *     file:// URIs all open fine once the host is warm, while the first call
 *     fails for a 1920x1080 PNG, a JPEG, a TIFF and a 4x4 scratch document
 *     alike.
 *     Mitigation: assets/ps-warmup.jsx is executed by ps-helper.ps1 right after
 *     Photoshop reports ready (creates and discards a 4x4 document), plus a
 *     short retry inside the open helpers as a second line of defence.
 *
 *   PS 24-27
 *     No cold-start failure observed; nothing to do.
 *
 * This module only reports what was observed; it never gates a feature on a
 * version number, because the runtime retry — not the version — is the fix.
 */

/** Major version number from a "28.0.0"-style string (null when unknown). */
export function parsePsMajor(version) {
  const match = /^\s*(\d+)/.exec(String(version ?? ''))
  return match ? Number(match[1]) : null
}

/**
 * Describe the document-open behaviour of a given Photoshop version.
 *   coldStart  — whether the first document operation can fail on a fresh host
 *   retry      — whether the open helpers retry (always true: it is harmless)
 *   warmup     — whether ps-helper.ps1 runs assets/ps-warmup.jsx before use
 */
export function psCompat(version) {
  const major = parsePsMajor(version)
  const coldStart = major !== null && major >= 28
  return {
    major,
    coldStart,
    retry: true,
    warmup: coldStart,
    note: coldStart
      ? 'PS 28 冷启动后第一次文档/开图操作会报“发生了常规 Photoshop 错误”，已由启动预热 + 打开重试自动兜住'
      : major === null
        ? '未取得 Photoshop 版本；打开路径已带预热重试，2024-2027 均可用'
        : 'PS 24-27：未观察到冷启动失败，打开路径仍保留重试兜底',
  }
}