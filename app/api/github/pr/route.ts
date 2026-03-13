import { prisma } from "@/lib/prisma"
import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const { owner, repo, head, base } = body

  if (!owner || !repo || !head || !base) {
    return badRequest("Missing required fields")
  }

  try {
    // Get commits between base and head for PR body
    const compareRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )

    let prBody = ""
    if (compareRes.ok) {
      const compareData = await compareRes.json()
      const commits = (compareData.commits || []) as { commit: { message: string } }[]
      if (commits.length > 0) {
        prBody = commits
          .map((c: { commit: { message: string } }) => `- ${c.commit.message}`)
          .join("\n")
      }
    }

    // Generate title from branch name
    const title = head
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase())

    // Create the PR
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          title,
          body: prBody || "Automated PR",
          head,
          base,
        }),
      }
    )

    const prData = await prRes.json()
    if (!prRes.ok) {
      const message = (prData as { message?: string }).message || `PR creation failed (${prRes.status})`
      return Response.json({ error: message }, { status: prRes.status })
    }

    // Update branch with PR URL
    const branchRecord = await prisma.branch.findFirst({
      where: {
        name: head,
        repo: {
          owner,
          name: repo,
          userId: auth.userId,
        },
      },
    })
    if (branchRecord) {
      await prisma.branch.update({
        where: { id: branchRecord.id },
        data: { prUrl: prData.html_url },
      })
    }

    return Response.json({
      url: prData.html_url,
      number: prData.number,
      title: prData.title,
    })
  } catch (error: unknown) {
    return internalError(error)
  }
}
