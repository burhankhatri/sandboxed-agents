# Agent SDK Refactoring Proposal

## Executive Summary

The current SDK has a **monolithic Provider base class** (815 LOC) that handles 10+ concerns, **duplicated tool name mappings** across providers, **complex environment variable precedence**, and **provider-specific logic in the base class**. This makes implementing new agents difficult and leaks the agent abstraction.

This proposal introduces a **clean separation of concerns** through:
1. A **declarative provider definition** system
2. **Centralized tool normalization**
3. **Extracted background session management**
4. **Composable command building**
5. **Pluggable provider registry**

---

## Current Problems

### 1. Monolithic Base Class (815 LOC)
The `Provider` base class handles:
- Lifecycle management (setup, ready promise)
- Command execution
- Event parsing orchestration
- Background session state machine (500+ LOC)
- Process management (start, poll, kill)
- Environment variable precedence (3 layers)
- Provider-specific logic (Codex login, Claude system prompt detection)

### 2. Duplicated Tool Name Mappings
Each provider has its own mapping:
```typescript
// Claude
const CLAUDE_TOOL_NAME_MAP = { Write: "write", Bash: "shell", ... }

// Gemini
const GEMINI_TOOL_NAME_MAP = { execute_code: "shell", write_file: "write", ... }

// Codex
const CODEX_ITEM_TYPE_MAP = { command_execution: "shell", file_change: "write", ... }
```

### 3. Provider-Specific Logic in Base Class
```typescript
// In base.ts - hardcoded provider check
const supportsNativeSystemPrompt = this.name === "claude"

// Codex-specific login in base class
if (this.name !== "codex") return
await this.sandboxManager.executeCommand(`echo '${safeKey}' | codex login...`)
```

### 4. Adding a New Provider Requires:
1. Create provider class extending 815 LOC base
2. Implement `getCommand()` with ad-hoc pattern
3. Implement `parse()` with full JSON parsing
4. Add tool name mapping (duplicate)
5. Modify factory switch statement
6. Update ProviderName union type
7. Update getProviderNames() hardcoded list
8. Modify tests in multiple places

---

## Proposed Architecture

### New Directory Structure
```
packages/agents/src/
├── core/
│   ├── agent.ts              # Clean Agent interface + AgentRunner
│   ├── events.ts             # Event types (unchanged)
│   ├── tools.ts              # NEW: Centralized tool normalization
│   ├── command-builder.ts    # NEW: Composable command building
│   └── registry.ts           # NEW: Pluggable provider registry
├── background/
│   ├── session-manager.ts    # NEW: Extracted background session logic
│   ├── polling.ts            # NEW: Polling state machine
│   └── types.ts              # Background-specific types
├── agents/                   # Renamed from providers/
│   ├── claude/
│   │   ├── index.ts          # Claude agent definition
│   │   ├── parser.ts         # Pure parsing function (testable)
│   │   └── tools.ts          # Tool mappings for this agent
│   ├── codex/
│   │   ├── index.ts
│   │   ├── parser.ts
│   │   └── tools.ts
│   ├── gemini/
│   │   └── ...
│   └── opencode/
│       └── ...
├── sandbox/
│   └── ... (unchanged)
└── index.ts
```

---

## Core Design: Declarative Agent Definitions

### The Agent Interface (Simple & Focused)

```typescript
// core/agent.ts

/**
 * Minimal interface for implementing a new agent.
 * No inheritance required - just implement this interface.
 */
export interface AgentDefinition {
  /** Unique agent identifier */
  readonly name: string

  /** Build CLI command from options */
  buildCommand(options: RunOptions): CommandSpec

  /** Parse a line of output into event(s) */
  parse(line: string, context: ParseContext): Event | Event[] | null

  /** Tool name mappings (provider-specific -> canonical) */
  readonly toolMappings: Record<string, string>

  /** Optional: Agent-specific capabilities */
  readonly capabilities?: AgentCapabilities
}

export interface AgentCapabilities {
  /** Agent supports native system prompt (vs synthetic prefix) */
  supportsSystemPrompt?: boolean
  /** Agent requires special setup (e.g., login) */
  setup?: (sandbox: CodeAgentSandbox, env: Record<string, string>) => Promise<void>
  /** Agent supports session resumption */
  supportsResume?: boolean
}

export interface CommandSpec {
  cmd: string
  args: string[]
  env?: Record<string, string>
  /** If true, wrap in bash for stderr handling */
  wrapInBash?: boolean
}

export interface ParseContext {
  /** Mutable state for stateful parsing (e.g., Gemini tool buffer) */
  state: Record<string, unknown>
  /** Current session ID if known */
  sessionId: string | null
}
```

### Example: Claude Agent Definition

```typescript
// agents/claude/index.ts

import { AgentDefinition, CommandSpec, ParseContext } from '../../core/agent.js'
import { Event } from '../../core/events.js'
import { parseClaudeLine } from './parser.js'
import { CLAUDE_TOOL_MAPPINGS } from './tools.js'

export const claudeAgent: AgentDefinition = {
  name: 'claude',

  toolMappings: CLAUDE_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: true,
    supportsResume: true,
  },

  buildCommand(options): CommandSpec {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }
    if (options.model) {
      args.push('--model', options.model)
    }
    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }
    if (options.prompt) {
      args.push(options.prompt)
    }

    return { cmd: 'claude', args, env: options.env }
  },

  parse(line, context): Event | Event[] | null {
    return parseClaudeLine(line, this.toolMappings)
  },
}
```

### Example: Claude Parser (Pure Function - Easily Testable)

```typescript
// agents/claude/parser.ts

import { Event } from '../../core/events.js'
import { createToolStartEvent, normalizeToolName } from '../../core/tools.js'
import { safeJsonParse } from '../../utils/json.js'

interface ClaudeSystemInit {
  type: 'system'
  subtype: 'init'
  session_id: string
}

interface ClaudeAssistantMessage {
  type: 'assistant'
  message: { content: Array<{ type: string; text?: string; name?: string; input?: unknown }> }
}

// ... other types

type ClaudeEvent = ClaudeSystemInit | ClaudeAssistantMessage | /* ... */

export function parseClaudeLine(
  line: string,
  toolMappings: Record<string, string>
): Event | Event[] | null {
  const json = safeJsonParse<ClaudeEvent>(line)
  if (!json) return null

  if (json.type === 'system' && json.subtype === 'init') {
    return { type: 'session', id: json.session_id }
  }

  if (json.type === 'assistant' && json.message?.content) {
    for (const block of json.message.content) {
      if (block.type === 'text' && block.text) {
        return { type: 'token', text: block.text }
      }
      if (block.type === 'tool_use' && block.name) {
        return createToolStartEvent(normalizeToolName(block.name, toolMappings), block.input)
      }
    }
  }

  // ... rest of parsing
  return null
}
```

---

## Centralized Tool Normalization

### Single Source of Truth

```typescript
// core/tools.ts

/**
 * Canonical tool names used across all agents.
 * Consumers only see these names.
 */
export type CanonicalToolName = 'read' | 'write' | 'edit' | 'glob' | 'grep' | 'shell' | 'web_search'

/**
 * Normalize a provider-specific tool name to canonical form.
 * Uses agent's mappings first, then falls back to lowercase.
 */
export function normalizeToolName(
  providerName: string,
  agentMappings: Record<string, string>
): string {
  return agentMappings[providerName] ?? providerName.toLowerCase()
}

/**
 * Reverse mapping: canonical -> display name (for UI)
 */
export const CANONICAL_DISPLAY_NAMES: Record<CanonicalToolName, string> = {
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',
  shell: 'Bash',
  web_search: 'Web Search',
}

// Tool input normalization stays here (already well-structured)
export { createToolStartEvent } from './events.js'
```

### Agent-Specific Mappings (Colocated with Agent)

```typescript
// agents/claude/tools.ts
export const CLAUDE_TOOL_MAPPINGS: Record<string, string> = {
  Write: 'write',
  Read: 'read',
  Edit: 'edit',
  Glob: 'glob',
  Grep: 'grep',
  Bash: 'shell',
  WebSearch: 'web_search',
}

// agents/gemini/tools.ts
export const GEMINI_TOOL_MAPPINGS: Record<string, string> = {
  execute_code: 'shell',
  run_command: 'shell',
  bash: 'shell',
  write_file: 'write',
  read_file: 'read',
  apply_patch: 'edit',
  glob_file_search: 'glob',
  grep_search: 'grep',
}
```

---

## Pluggable Agent Registry

### Replace Switch Statement with Registry

```typescript
// core/registry.ts

import { AgentDefinition } from './agent.js'

class AgentRegistry {
  private agents = new Map<string, AgentDefinition>()

  /**
   * Register an agent definition.
   * Call this for each agent you want to make available.
   */
  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent "${agent.name}" is already registered`)
    }
    this.agents.set(agent.name, agent)
  }

  /**
   * Get an agent definition by name.
   */
  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name)
  }

  /**
   * Get all registered agent names.
   */
  getNames(): string[] {
    return Array.from(this.agents.keys())
  }

  /**
   * Check if an agent is registered.
   */
  has(name: string): boolean {
    return this.agents.has(name)
  }
}

// Singleton registry
export const registry = new AgentRegistry()

// Type-safe factory function
export function createAgent(name: string): AgentDefinition {
  const agent = registry.get(name)
  if (!agent) {
    throw new Error(
      `Unknown agent: "${name}". Available: ${registry.getNames().join(', ')}`
    )
  }
  return agent
}
```

### Auto-Registration

```typescript
// agents/index.ts

import { registry } from '../core/registry.js'
import { claudeAgent } from './claude/index.js'
import { codexAgent } from './codex/index.js'
import { geminiAgent } from './gemini/index.js'
import { opencodeAgent } from './opencode/index.js'

// Register all built-in agents
registry.register(claudeAgent)
registry.register(codexAgent)
registry.register(geminiAgent)
registry.register(opencodeAgent)

// Export for direct import if needed
export { claudeAgent, codexAgent, geminiAgent, opencodeAgent }
```

### Adding a New Agent (3 Steps!)

```typescript
// agents/my-new-agent/index.ts

import { AgentDefinition } from '../../core/agent.js'
import { parseMyAgentLine } from './parser.js'

export const myNewAgent: AgentDefinition = {
  name: 'my-new-agent',

  toolMappings: {
    'execute_command': 'shell',
    'create_file': 'write',
    // ...
  },

  capabilities: {
    supportsSystemPrompt: false,
    supportsResume: true,
    setup: async (sandbox, env) => {
      // Any special setup needed
      await sandbox.executeCommand('my-agent auth login')
    },
  },

  buildCommand(options) {
    return {
      cmd: 'my-agent',
      args: ['run', '--json', options.prompt ?? ''],
    }
  },

  parse(line, context) {
    return parseMyAgentLine(line, this.toolMappings)
  },
}

// To register, just import and call:
// registry.register(myNewAgent)
```

---

## Extracted Background Session Manager

### Separate Concerns

```typescript
// background/session-manager.ts

import { AgentDefinition } from '../core/agent.js'
import { Event } from '../core/events.js'
import { CodeAgentSandbox } from '../types/provider.js'

export interface BackgroundSession {
  readonly sessionDir: string
  readonly agent: AgentDefinition

  /** Start a new turn */
  start(options: RunOptions): Promise<TurnHandle>

  /** Poll for events from current turn */
  poll(): Promise<PollResult>

  /** Cancel current turn */
  cancel(): Promise<void>

  /** Check if a turn is running */
  isRunning(): Promise<boolean>
}

export interface TurnHandle {
  executionId: string
  pid: number
  outputFile: string
}

export interface PollResult {
  events: Event[]
  cursor: string
  running: boolean
  runPhase: 'idle' | 'starting' | 'running' | 'stopped'
}

/**
 * Create a background session manager.
 * All the complex polling/state machine logic lives here,
 * completely separate from agent definition.
 */
export function createBackgroundSession(
  agent: AgentDefinition,
  sandbox: CodeAgentSandbox,
  sessionDir: string
): BackgroundSession {
  return new BackgroundSessionImpl(agent, sandbox, sessionDir)
}

class BackgroundSessionImpl implements BackgroundSession {
  private meta: SessionMeta | null = null
  private parseContext: ParseContext = { state: {}, sessionId: null }

  constructor(
    readonly agent: AgentDefinition,
    private sandbox: CodeAgentSandbox,
    readonly sessionDir: string
  ) {}

  async start(options: RunOptions): Promise<TurnHandle> {
    // All the turn starting logic extracted here
    // Uses agent.buildCommand() to get the command
    // Uses agent.capabilities?.setup() if needed
  }

  async poll(): Promise<PollResult> {
    // All the polling state machine logic extracted here
    // Uses agent.parse() to parse lines
    // Handles grace periods, crash detection, etc.
  }

  async cancel(): Promise<void> {
    // Kill logic
  }

  async isRunning(): Promise<boolean> {
    // Check done file
  }
}
```

---

## AgentRunner: The New "Provider"

### Composition Over Inheritance

```typescript
// core/agent-runner.ts

import { AgentDefinition, ParseContext } from './agent.js'
import { Event } from './events.js'
import { CodeAgentSandbox } from '../types/provider.js'

export interface AgentRunnerOptions {
  agent: AgentDefinition
  sandbox: CodeAgentSandbox
  runDefaults?: RunDefaults
}

/**
 * Runs an agent definition against a sandbox.
 * This replaces the monolithic Provider base class.
 */
export class AgentRunner {
  private agent: AgentDefinition
  private sandbox: CodeAgentSandbox
  private runDefaults: RunDefaults
  private parseContext: ParseContext = { state: {}, sessionId: null }
  private readyPromise: Promise<void>

  constructor(options: AgentRunnerOptions) {
    this.agent = options.agent
    this.sandbox = options.sandbox
    this.runDefaults = options.runDefaults ?? {}

    // Setup: install + agent-specific setup
    this.readyPromise = this.setup()
  }

  get name(): string {
    return this.agent.name
  }

  get sessionId(): string | null {
    return this.parseContext.sessionId
  }

  get ready(): Promise<void> {
    return this.readyPromise
  }

  private async setup(): Promise<void> {
    await this.sandbox.ensureProvider(this.agent.name)

    // Agent-specific setup (e.g., Codex login)
    if (this.agent.capabilities?.setup) {
      await this.agent.capabilities.setup(this.sandbox, this.runDefaults.env ?? {})
    }
  }

  async *run(promptOrOptions: string | RunOptions = {}): AsyncGenerator<Event> {
    await this.readyPromise

    const options = this.mergeOptions(promptOrOptions)
    const commandSpec = this.agent.buildCommand(options)
    const fullCommand = this.buildFullCommand(commandSpec)

    for await (const line of this.sandbox.executeCommandStream(fullCommand)) {
      const events = this.parseLines(line)
      for (const event of events) {
        if (event.type === 'session') {
          this.parseContext.sessionId = event.id
        }
        yield event
      }
    }
  }

  private parseLines(line: string): Event[] {
    const result = this.agent.parse(line, this.parseContext)
    if (result === null) return []
    return Array.isArray(result) ? result : [result]
  }

  private mergeOptions(promptOrOptions: string | RunOptions): RunOptions {
    if (typeof promptOrOptions === 'string') {
      return { ...this.runDefaults, prompt: promptOrOptions }
    }

    // Handle system prompt for agents without native support
    const options = { ...this.runDefaults, ...promptOrOptions }
    if (options.systemPrompt && !this.agent.capabilities?.supportsSystemPrompt) {
      options.prompt = options.systemPrompt + '\n\n' + (options.prompt ?? '')
    }

    return options
  }

  private buildFullCommand(spec: CommandSpec): string {
    const quotedArgs = spec.args.map(arg => this.quoteArg(arg))
    const command = [spec.cmd, ...quotedArgs].join(' ')

    if (spec.wrapInBash) {
      return `bash -lc ${this.quoteArg(command)}`
    }
    return command
  }

  private quoteArg(arg: string): string {
    if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
      return `'${arg.replace(/'/g, "'\\''")}'`
    }
    return arg
  }
}
```

---

## Updated Public API

### Clean Session Creation

```typescript
// session.ts

import { AgentRunner, AgentRunnerOptions } from './core/agent-runner.js'
import { createAgent } from './core/registry.js'
import { adaptSandbox } from './sandbox/index.js'

export interface SessionOptions {
  sandbox: CodeAgentSandbox | DaytonaSandbox
  model?: string
  sessionId?: string
  timeout?: number
  systemPrompt?: string
  env?: Record<string, string>
  skipInstall?: boolean
}

/**
 * Create a session with an agent.
 *
 * @example
 * const session = await createSession('claude', { sandbox, env: { ANTHROPIC_API_KEY: '...' } })
 * for await (const event of session.run('Hello!')) {
 *   console.log(event)
 * }
 */
export async function createSession(
  agentName: string,
  options: SessionOptions
): Promise<AgentRunner> {
  const agent = createAgent(agentName)
  const sandbox = adaptSandbox(options.sandbox)

  const runner = new AgentRunner({
    agent,
    sandbox,
    runDefaults: {
      model: options.model,
      sessionId: options.sessionId,
      timeout: options.timeout,
      systemPrompt: options.systemPrompt,
      env: options.env,
    },
  })

  if (!options.skipInstall) {
    await runner.ready
  }

  return runner
}
```

---

## Migration Path

### Phase 1: Add New Architecture Alongside Old
1. Create `core/`, `background/`, and `agents/` directories
2. Implement new interfaces and registry
3. Create new agent definitions using new pattern
4. Keep old `Provider` class working

### Phase 2: Migrate Internally
1. Update internal code to use new patterns
2. Keep public API compatible via adapters
3. Add deprecation warnings to old APIs

### Phase 3: Remove Old Code
1. Remove monolithic `Provider` base class
2. Remove old factory
3. Update public API to new patterns

---

## Benefits Summary

### Before (Current)
| Aspect | Current State |
|--------|--------------|
| Adding new agent | 8+ files to modify |
| Tool mappings | Duplicated in 4+ places |
| Base class | 815 LOC monolith |
| Testing parsers | Requires full provider instance |
| Provider-specific logic | Scattered in base class |
| Background sessions | Tightly coupled to provider |

### After (Proposed)
| Aspect | New State |
|--------|-----------|
| Adding new agent | 1 file (agent definition) + register |
| Tool mappings | Colocated with agent, centralized normalization |
| Core classes | ~100 LOC AgentRunner + composable modules |
| Testing parsers | Pure functions, no instantiation needed |
| Provider-specific logic | In agent's `capabilities` |
| Background sessions | Separate, reusable module |

---

## Example: Adding a New Agent (Complete)

```typescript
// agents/cursor/index.ts

import { AgentDefinition } from '../../core/agent.js'
import { createToolStartEvent, normalizeToolName } from '../../core/tools.js'
import { safeJsonParse } from '../../utils/json.js'

// Tool mappings colocated with agent
const CURSOR_TOOL_MAPPINGS = {
  file_write: 'write',
  file_read: 'read',
  terminal: 'shell',
  search: 'grep',
}

// Parser is a pure function
function parseCursorLine(line: string, mappings: Record<string, string>) {
  const json = safeJsonParse(line)
  if (!json) return null

  if (json.type === 'session_start') {
    return { type: 'session', id: json.id }
  }
  if (json.type === 'text') {
    return { type: 'token', text: json.content }
  }
  if (json.type === 'tool_call') {
    return createToolStartEvent(normalizeToolName(json.tool, mappings), json.args)
  }
  if (json.type === 'done') {
    return { type: 'end' }
  }
  return null
}

// Agent definition - one object, all in one place
export const cursorAgent: AgentDefinition = {
  name: 'cursor',
  toolMappings: CURSOR_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: true,
    supportsResume: true,
  },

  buildCommand(options) {
    const args = ['--json']
    if (options.model) args.push('--model', options.model)
    if (options.sessionId) args.push('--session', options.sessionId)
    if (options.systemPrompt) args.push('--system', options.systemPrompt)
    if (options.prompt) args.push(options.prompt)
    return { cmd: 'cursor', args }
  },

  parse(line, context) {
    return parseCursorLine(line, this.toolMappings)
  },
}

// Register it
import { registry } from '../../core/registry.js'
registry.register(cursorAgent)
```

**That's it!** One file, ~50 lines, fully functional agent.

---

## Conclusion

This refactoring transforms the SDK from a **monolithic, inheritance-based architecture** into a **modular, composition-based system**. The key changes:

1. **AgentDefinition interface** replaces inheritance with a simple contract
2. **Centralized tool normalization** eliminates duplication
3. **Agent registry** replaces hardcoded factory switches
4. **Extracted background session manager** decouples complexity
5. **Pure parser functions** enable easy testing
6. **Colocated agent files** keep related code together

The result: **Adding a new agent is now trivial** - just implement a simple interface and register it. No more modifying 8+ files, no more understanding 815 LOC of base class behavior.
