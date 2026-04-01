/**
 * Playwright helpers to capture agent streaming / polling signals for debugging flaky streams.
 *
 * Browser logs: enable NEXT_PUBLIC_E2E_STREAM_DEBUG=1 on the Next dev server (see playwright.config).
 * CI/local: `PLAYWRIGHT_STREAM_DEBUG=1 npm run test:e2e -- e2e/diagnostics/`
 */
import type { Page, TestInfo } from "@playwright/test"

const AGENT_API = /\/api\/agent\//

export interface StreamInstrumentation {
  /** Lines captured from browser console ([stream-debug] only when env enabled) */
  browserLines: string[]
  /** Lines from network listener (method url -> status) */
  networkLines: string[]
  /** Call from test.afterEach or at end of test to attach as file */
  attachToTest: (testInfo: TestInfo) => Promise<void>
}

/**
 * Forward `[stream-debug]` browser logs and agent API response statuses to stdout.
 * Does not read response bodies (avoids blocking the page).
 */
export function attachStreamInstrumentation(page: Page): StreamInstrumentation {
  const browserLines: string[] = []
  const networkLines: string[] = []

  page.on("console", (msg) => {
    const text = msg.text()
    if (text.includes("[stream-debug]")) {
      const line = `[browser:${msg.type()}] ${text}`
      browserLines.push(line)
      console.log(line)
    }
  })

  page.on("response", (res) => {
    const url = res.url()
    if (!AGENT_API.test(url)) return
    const req = res.request()
    const line = `[network] ${req.method()} ${url.split("?")[0]} -> ${res.status()}`
    networkLines.push(line)
    console.log(line)
    if (!res.ok() && url.includes("/api/agent/execute")) {
      void res
        .text()
        .then((body) => {
          const errLine = `[network] execute body: ${body.slice(0, 800)}`
          networkLines.push(errLine)
          console.log(errLine)
        })
        .catch(() => {})
    }
  })

  return {
    browserLines,
    networkLines,
    attachToTest: async (testInfo: TestInfo) => {
      const blob = [
        "=== browser [stream-debug] ===",
        ...browserLines,
        "",
        "=== network /api/agent/* ===",
        ...networkLines,
      ].join("\n")
      await testInfo.attach("stream-instrumentation.txt", {
        body: blob,
        contentType: "text/plain",
      })
    },
  }
}
