import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Lightweight sync endpoint for cross-device state synchronization
// Returns branch statuses, last message info, and branch list changes
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const repoId = searchParams.get("repoId")

  if (!repoId) {
    return NextResponse.json({ error: "repoId required" }, { status: 400 })
  }

  try {
    // Verify user owns this repo
    const repo = await prisma.repo.findFirst({
      where: {
        id: repoId,
        userId: session.user.id,
      },
      select: {
        id: true,
        branches: {
          select: {
            id: true,
            name: true,
            status: true,
            prUrl: true,
            sandbox: {
              select: {
                status: true,
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 })
    }

    // Return compact sync data
    const syncData = {
      repoId: repo.id,
      timestamp: Date.now(),
      branches: repo.branches.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        prUrl: b.prUrl,
        sandboxStatus: b.sandbox?.status || null,
        lastMessageId: b.messages[0]?.id || null,
        lastMessageAt: b.messages[0]?.createdAt?.getTime() || null,
      })),
    }

    return NextResponse.json(syncData)
  } catch (error) {
    console.error("Sync error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
