# Background Execution Methods Test

This directory contains tests comparing different Daytona SDK methods for running Codex (or any long-running process) in the background, allowing you to "check back later" for results.

## The Goal

We want to:
1. Start a coding agent (Codex)
2. Return immediately (not block)
3. Come back later (potentially from a different "thread") to get results

## Methods Tested

### 1. SSH (`01-ssh.ts`)
Uses SSH with `nohup` to launch a detached process.

```typescript
const { token } = await sandbox.createSshAccess(60)
ssh.connect({ host: "ssh.app.daytona.io", port: 22, username: token })

// This returns immediately with PID
ssh.exec(`nohup sh -c 'command >> output.jsonl 2>&1' & echo $!`)
```

**Verdict**: ✅ TRUE ASYNC - Returns immediately with PID

### 2. executeCommand (`02-execute-command.ts`)
Uses the standard process execution API with shell backgrounding.

```typescript
await sandbox.process.executeCommand(
  `nohup command >> output.jsonl 2>&1 & echo $!`,
  undefined,
  { OPENAI_API_KEY: "..." },
  120
)
```

**Hypothesis**: Likely blocks until completion even with `&`

### 3. executeSessionCommand (`03-session-command.ts`)
Uses session-based execution with `runAsync` option.

```typescript
const session = await sandbox.process.createSession()
await sandbox.process.executeSessionCommand(session.sessionId, {
  command: "codex exec ...",
  runAsync: true,
})
```

**Hypothesis**: `runAsync` might provide true background execution

### 4. PTY (`04-pty.ts`)
Uses pseudo-terminal sessions that persist and can be reconnected.

```typescript
const pty = await sandbox.process.createPty({ id: "my-pty", ... })
await pty.sendInput("codex exec ...\n")
await pty.disconnect()  // Process keeps running

// Later...
const reconnected = await sandbox.process.connectPty("my-pty", {...})
```

**Verdict**: ✅ Pseudo-async via disconnect/reconnect pattern

## Running the Tests

```bash
# Set required environment variables
export DAYTONA_API_KEY="your-key"
export OPENAI_API_KEY="your-key"

# Run individual tests
npx tsx tests/background-methods/01-ssh.ts
npx tsx tests/background-methods/02-execute-command.ts
npx tsx tests/background-methods/03-session-command.ts
npx tsx tests/background-methods/04-pty.ts

# Or run all
./tests/background-methods/run-all.sh
```

## Expected Results

| Method | Returns Immediately? | True Background? | Reconnectable? |
|--------|---------------------|------------------|----------------|
| SSH + nohup | ✅ Yes | ✅ Yes | N/A (poll file) |
| executeCommand | ❓ Test | ❓ Test | N/A |
| executeSessionCommand | ❓ Test | ❓ Test | Via session |
| PTY | ✅ Yes (sendInput) | ✅ Yes | ✅ Yes |

## Polling for Results

All methods write output to a JSONL file that can be polled:

```typescript
// Poll for new content
const result = await sandbox.process.executeCommand(`cat ${outputFile}`)
const content = result.result || ""

// Check for completion marker
const done = await sandbox.process.executeCommand(`test -f ${outputFile}.done && echo done`)
```
