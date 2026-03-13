import { prisma } from "@/lib/prisma"

export interface SnapshotData {
  content?: string
  toolCalls?: unknown[]
  contentBlocks?: unknown[]
}

/**
 * Write the latest streaming snapshot to the execution row.
 * Status API reads this until completion (then final content is on Message).
 */
export async function updateSnapshot(
  executionId: string,
  data: SnapshotData
): Promise<void> {
  await (prisma as any).agentExecution.update({
    where: { id: executionId },
    data: { latestSnapshot: data },
  })
}
