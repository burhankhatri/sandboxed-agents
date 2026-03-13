import { prisma } from "@/lib/prisma"

// In-memory buffers for batching writes
const eventBuffers = new Map<string, Array<{ type: string; data: object }>>()
const flushIntervals = new Map<string, NodeJS.Timeout>()

function getAgentEventDelegate() {
  const delegate = (prisma as { agentEvent?: typeof prisma.agentExecution }).agentEvent
  if (!delegate) {
    throw new Error(
      "Prisma client is missing AgentEvent model. Run: npx prisma generate"
    )
  }
  return delegate as any
}

/**
 * Append an event to the execution's event stream.
 * Events are buffered and flushed periodically for efficiency.
 */
export async function appendEvent(
  executionId: string,
  type: string,
  data: object
): Promise<number> {
  // Get or create buffer
  let buffer = eventBuffers.get(executionId)
  if (!buffer) {
    buffer = []
    eventBuffers.set(executionId, buffer)

    // Start flush interval (every 500ms)
    const interval = setInterval(() => {
      flushEvents(executionId).catch(console.error)
    }, 500)
    flushIntervals.set(executionId, interval)
  }

  buffer.push({ type, data })

  // Flush immediately if buffer is large
  if (buffer.length >= 10) {
    await flushEvents(executionId)
  }

  // We don't guarantee an exact index here; SSE consumers rely on the
  // monotonically increasing eventIndex stored in the database.
  return 0
}

/**
 * Flush buffered events to the database.
 * Called periodically and on completion.
 */
export async function flushEvents(executionId: string): Promise<void> {
  const buffer = eventBuffers.get(executionId)
  if (!buffer || buffer.length === 0) return

  // Batch insert
  const agentEvent = getAgentEventDelegate()
  try {
    // Always compute the base index from the database to avoid race conditions
    // across processes. This, combined with skipDuplicates, prevents unique
    // constraint violations when two workers flush around the same time.
    const lastEvent = await agentEvent.findFirst({
      where: { executionId },
      orderBy: { eventIndex: "desc" },
      select: { eventIndex: true },
    })
    const baseIndex = (lastEvent?.eventIndex ?? 0) + 1

    await agentEvent.createMany({
      data: buffer.map((event, i) => ({
        executionId,
        eventIndex: baseIndex + i,
        type: event.type,
        data: event.data,
      })),
      skipDuplicates: true,
    })

    // Clear buffer
    buffer.length = 0

  } catch (error) {
    console.error(`Failed to flush events for execution ${executionId}:`, error)
    throw error
  }
}

/**
 * Cleanup events for an execution.
 * Called after execution completes and clients have received the complete event.
 */
export async function cleanupEvents(executionId: string): Promise<void> {
  // Stop flush interval
  const interval = flushIntervals.get(executionId)
  if (interval) {
    clearInterval(interval)
    flushIntervals.delete(executionId)
  }

  // Clear buffer and counter
  eventBuffers.delete(executionId)

  // Delete from DB (events are preserved in final message content)
  try {
    const agentEvent = getAgentEventDelegate()
    await agentEvent.deleteMany({
      where: { executionId },
    })
  } catch (error) {
    console.error(`Failed to cleanup events for execution ${executionId}:`, error)
  }
}

/**
 * Check if an execution has any events (buffered or in DB).
 */
export async function hasEvents(executionId: string): Promise<boolean> {
  const bufferCount = eventBuffers.get(executionId)?.length ?? 0
  if (bufferCount > 0) return true

  const agentEvent = getAgentEventDelegate()
  const count = await agentEvent.count({
    where: { executionId },
  })

  return count > 0
}
