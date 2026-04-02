#!/usr/bin/env npx tsx
/**
 * Generate JSONL Reference Files from Real Agent Runs
 *
 * This script runs each provider in a Daytona sandbox and captures
 * the actual raw JSONL output to create reference files.
 *
 * Usage:
 *   # Set required API keys
 *   export DAYTONA_API_KEY=...
 *   export ANTHROPIC_API_KEY=...  # for claude, opencode
 *   export OPENAI_API_KEY=...     # for codex
 *   export GEMINI_API_KEY=...     # for gemini
 *
 *   # Run the script
 *   npx tsx scripts/generate-jsonl-references.ts
 *
 * Output:
 *   tests/fixtures/jsonl-reference/
 *     ├── claude.jsonl          - Claude Code CLI raw output
 *     ├── codex.jsonl           - OpenAI Codex CLI raw output
 *     ├── gemini.jsonl          - Google Gemini CLI raw output
 *     └── opencode.jsonl        - OpenCode CLI raw output
 */

import "dotenv/config"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { Daytona, type Sandbox } from "@daytonaio/sdk"
import { createBackgroundSession, type Event, type ProviderName } from "../src/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, "..", "tests", "fixtures", "jsonl-reference")

// Ensure fixtures directory exists
mkdirSync(FIXTURES_DIR, { recursive: true })

// Check for API keys (TEST_ prefixed versions take precedence)
const DAYTONA_API_KEY = process.env.TEST_DAYTONA_API_KEY || process.env.DAYTONA_API_KEY
const ANTHROPIC_API_KEY = process.env.TEST_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || process.env.OPENAI_API_KEY
const GEMINI_API_KEY =
  process.env.TEST_GEMINI_API_KEY ||
  process.env.TEST_GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY

if (!DAYTONA_API_KEY) {
  console.error("Error: DAYTONA_API_KEY is required")
  process.exit(1)
}

// A prompt that exercises multiple features: text response and tool usage
const TEST_PROMPT = `Please do the following:
1. Tell me what 2 + 2 equals
2. List the files in the current directory using ls
3. Create a file called hello.txt with the content "Hello, World!"
4. Read the file you just created
Keep your responses brief.`

// Provider configurations
interface ProviderConfig {
  name: ProviderName
  apiKeyEnvVar: string
  apiKey: string | undefined
  model?: string
}

const providers: ProviderConfig[] = [
  {
    name: "claude",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    apiKey: ANTHROPIC_API_KEY,
  },
  {
    name: "codex",
    apiKeyEnvVar: "OPENAI_API_KEY",
    apiKey: OPENAI_API_KEY,
  },
  {
    name: "gemini",
    apiKeyEnvVar: "GEMINI_API_KEY",
    apiKey: GEMINI_API_KEY,
  },
  {
    name: "opencode",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    apiKey: ANTHROPIC_API_KEY,
    model: "anthropic/claude-sonnet-4-6",
  },
]

// Helper to poll for completion
async function pollUntilEnd(
  bg: Awaited<ReturnType<typeof createBackgroundSession>>,
  timeoutMs = 180_000,
  pollIntervalMs = 2000
): Promise<Event[]> {
  const deadline = Date.now() + timeoutMs
  let allEvents: Event[] = []

  while (Date.now() < deadline) {
    const { events } = await bg.getEvents()
    allEvents = events
    if (events.some((e) => e.type === "end" || e.type === "agent_crashed")) break
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
  return allEvents
}

// Fetch raw JSONL content from sandbox
async function getRawJsonl(sandbox: Sandbox, outputFile: string): Promise<string> {
  const result = await sandbox.process.executeCommand(`cat ${outputFile}`)
  return result.output ?? ""
}

async function generateReferenceForProvider(
  daytona: Daytona,
  config: ProviderConfig
): Promise<void> {
  if (!config.apiKey) {
    console.log(`Skipping ${config.name}: ${config.apiKeyEnvVar} not set`)
    return
  }

  console.log(`\nGenerating reference for ${config.name}...`)

  let sandbox: Sandbox | null = null

  try {
    // Create sandbox
    console.log(`  Creating sandbox...`)
    sandbox = await daytona.create({
      envVars: { [config.apiKeyEnvVar]: config.apiKey },
    })

    // Create background session
    console.log(`  Creating background session...`)
    const bg = await createBackgroundSession(config.name, {
      sandbox: sandbox as any,
      timeout: 180,
      model: config.model,
      env: { [config.apiKeyEnvVar]: config.apiKey },
    })

    // Start the session
    console.log(`  Starting agent with test prompt...`)
    const startResult = await bg.start(TEST_PROMPT)
    console.log(`  PID: ${startResult.pid}, Output file: ${startResult.outputFile}`)

    // Wait for completion
    console.log(`  Waiting for completion...`)
    const events = await pollUntilEnd(bg)
    console.log(`  Received ${events.length} events`)

    // Fetch raw JSONL
    console.log(`  Fetching raw JSONL output...`)
    const rawJsonl = await getRawJsonl(sandbox, startResult.outputFile)

    // Write to file
    const outputPath = join(FIXTURES_DIR, `${config.name}.jsonl`)
    writeFileSync(outputPath, rawJsonl, "utf8")
    console.log(`  Written to: ${outputPath}`)

    // Show stats
    const lines = rawJsonl.split("\n").filter((l) => l.trim())
    console.log(`  Lines: ${lines.length}, Size: ${rawJsonl.length} bytes`)
  } catch (error) {
    console.error(`  Error generating reference for ${config.name}:`, error)
  } finally {
    // Clean up sandbox
    if (sandbox) {
      console.log(`  Cleaning up sandbox...`)
      try {
        await sandbox.delete()
      } catch (e) {
        console.error(`  Error deleting sandbox:`, e)
      }
    }
  }
}

async function main() {
  console.log("JSONL Reference File Generator")
  console.log("==============================")
  console.log(`Output directory: ${FIXTURES_DIR}`)
  console.log()

  // Show which providers will be tested
  console.log("Provider availability:")
  for (const p of providers) {
    console.log(`  ${p.name}: ${p.apiKey ? "✓ API key set" : "✗ API key missing"}`)
  }

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY! })

  for (const config of providers) {
    await generateReferenceForProvider(daytona, config)
  }

  console.log("\nDone!")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
