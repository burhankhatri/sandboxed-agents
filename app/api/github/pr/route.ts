export async function POST(req: Request) {
  const body = await req.json()
  const { token, owner, repo, head, base } = body

  if (!token || !owner || !repo || !head || !base) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    // Get commits between base and head for PR body
    const compareRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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

    return Response.json({
      url: prData.html_url,
      number: prData.number,
      title: prData.title,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
