# Agents Package Refactoring Plan

## Goal
Make the library **simple and reliable**. Drop unnecessary complexity.

---

## Key Finding from Tests

**`executeCommand` + `nohup` is the best method for background execution:**
- Faster than SSH (61ms vs 835ms launch time)
- No SSH connection management
- No `ssh2` dependency
- Works reliably with all providers

**Keep PTY for streaming** - it already works well.

---

## Changes

### 1. Drop SSH for Background Execution

**Current:** Background execution requires SSH, adds complexity and a native dependency.

**New:** Use `executeCommand` with `nohup`:

```typescript
// Simple, no SSH needed
const wrapper = `nohup sh -c '${command} >> ${outputFile} 2>&1; echo 1 > ${outputFile}.done' > /dev/null 2>&1 & echo $!`
const result = await sandbox.process.executeCommand(wrapper)
const pid = parseInt(result.result.trim())
```

### 2. Fix Process Detection

**Current:** Uses `kill -0` which returns true for zombie processes.

**New:** Check actual process state:

```typescript
async function isRunning(pid: number): Promise<boolean> {
  const result = await sandbox.process.executeCommand(
    `ps -p ${pid} -o state= 2>/dev/null || echo X`
  )
  const state = result.result?.trim()
  return state !== "Z" && state !== "X" && state !== ""
}
```

### 3. Robust Kill

**Current:** Single `kill` command often fails.

**New:** Multi-step kill:

```typescript
async function kill(pid: number, processName?: string): Promise<boolean> {
  // Graceful
  await sandbox.process.executeCommand(`kill -TERM ${pid} 2>/dev/null || true`)
  await sleep(500)

  if (await isRunning(pid)) {
    // Force
    await sandbox.process.executeCommand(`kill -9 ${pid} 2>/dev/null || true`)
    await sleep(300)
  }

  if (processName && await isRunning(pid)) {
    // Last resort
    await sandbox.process.executeCommand(`pkill -9 -f "${processName}" 2>/dev/null || true`)
  }

  return !await isRunning(pid)
}
```

### 4. Simplify Sandbox Adapter

**Current:** `daytona.ts` is 312 lines with SSH logic, timing tests, complex env handling.

**New:** ~100 lines:

```typescript
export function adaptDaytonaSandbox(sandbox: Sandbox, env?: Record<string, string>): CodeAgentSandbox {
  return {
    env: { ...env },

    async executeCommand(command: string, timeout = 60) {
      const envPrefix = buildEnvPrefix(this.env)
      const result = await sandbox.process.executeCommand(
        `${envPrefix} ${command}`, undefined, undefined, timeout
      )
      return { exitCode: result.exitCode ?? 0, output: result.result ?? "" }
    },

    async startBackground(command: string, outputFile: string) {
      const envPrefix = buildEnvPrefix(this.env)
      const wrapper = `nohup sh -c '${envPrefix} ${command} >> ${outputFile} 2>&1; echo 1 > ${outputFile}.done' > /dev/null 2>&1 & echo $!`
      const result = await sandbox.process.executeCommand(wrapper)
      return { pid: parseInt(result.result?.trim() || "0") }
    },

    async isRunning(pid: number) {
      const result = await sandbox.process.executeCommand(`ps -p ${pid} -o state= 2>/dev/null || echo X`)
      const state = result.result?.trim()
      return state !== "Z" && state !== "X" && state !== ""
    },

    async kill(pid: number, processName?: string) {
      await sandbox.process.executeCommand(`kill -TERM ${pid} 2>/dev/null; sleep 0.5; kill -9 ${pid} 2>/dev/null || true`)
      if (processName) {
        await sandbox.process.executeCommand(`pkill -9 -f "${processName}" 2>/dev/null || true`)
      }
    },

    async *stream(command: string, timeout = 120) {
      // Keep current PTY implementation - it works
    },

    async ensureProvider(name: ProviderName) {
      // Keep current implementation
    }
  }
}
```

### 5. Clean Up Provider Base Class

**Current:** 784 lines mixing execution logic with provider logic.

**New:** Split into:
- `Provider` (~200 lines): Command building + parsing only
- Execution handled by sandbox adapter

---

## What to Remove

1. **SSH execution** (`ssh2` import, connection management, `execOverSsh`)
2. **SSH timing tests** (`CODING_AGENTS_SSH_TIMING_TESTS`)
3. **Three-level environment precedence** (just use one `env` object)
4. **Execution methods in Provider** (move to sandbox adapter)

---

## What to Keep

1. **PTY streaming** - works great
2. **Provider parsing logic** - solid event normalization
3. **Tool name canonicalization** - useful abstraction
4. **Session/BackgroundSession API** - good interface

---

## Implementation Order

1. **Update `daytona.ts`**: Replace SSH with `executeCommand` + `nohup`
2. **Fix `isRunning`**: Use `ps -o state` instead of `kill -0`
3. **Fix `kill`**: Multi-step kill sequence
4. **Remove `ssh2` dependency**: Update package.json
5. **Simplify env handling**: Single `env` object
6. **Clean up Provider base**: Move execution to sandbox

---

## Result

- **Fewer dependencies**: Drop `ssh2`
- **Simpler code**: ~400 lines removed
- **Faster**: 61ms vs 835ms background launch
- **More reliable**: Proper process state detection and kill
