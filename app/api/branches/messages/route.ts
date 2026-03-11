import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Prevent Next.js from caching this route - always fetch fresh data
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const cursor = searchParams.get("cursor") // For pagination
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500) // Default 100, max 500

  if (!branchId) {
    return Response.json({ error: "Missing branch ID" }, { status: 400 })
  }

  // Verify ownership
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { repo: true },
  })

  if (!branch || branch.repo.userId !== session.user.id) {
    return Response.json({ error: "Branch not found" }, { status: 404 })
  }

  const messages = await prisma.message.findMany({
    where: { branchId },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
  })

  // Get total count for pagination info
  const totalCount = await prisma.message.count({
    where: { branchId },
  })

  const nextCursor = messages.length === limit ? messages[messages.length - 1]?.id : null

  return Response.json({
    messages,
    pagination: {
      totalCount,
      hasMore: !!nextCursor,
      nextCursor,
    },
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { branchId, role, content, toolCalls, contentBlocks, timestamp, commitHash, commitMessage } = body

  if (!branchId || !role) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Verify ownership
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { repo: true },
  })

  if (!branch || branch.repo.userId !== session.user.id) {
    return Response.json({ error: "Branch not found" }, { status: 404 })
  }

  const message = await prisma.message.create({
    data: {
      branchId,
      role,
      content: content || "",
      toolCalls,
      contentBlocks,
      timestamp,
      commitHash,
      commitMessage,
    },
  })

  return Response.json({ message })
}

// Update a message (for streaming updates)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { messageId, content, toolCalls, contentBlocks } = body

  if (!messageId) {
    return Response.json({ error: "Missing message ID" }, { status: 400 })
  }

  // Verify ownership through branch -> repo
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { branch: { include: { repo: true } } },
  })

  if (!message || message.branch.repo.userId !== session.user.id) {
    return Response.json({ error: "Message not found" }, { status: 404 })
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      ...(content !== undefined && { content }),
      ...(toolCalls !== undefined && { toolCalls }),
      ...(contentBlocks !== undefined && { contentBlocks }),
    },
  })

  return Response.json({ message: updatedMessage })
}
