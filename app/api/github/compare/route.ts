export async function POST(req: Request) {
  const body = await req.json()
  const { githubPat, owner, repo, base, head, commitHash } = body

  if (!githubPat || !owner || !repo) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const headers = {
    Authorization: `Bearer ${githubPat}`,
    Accept: "application/vnd.github.v3.diff",
  }

  try {
    let url: string
    if (commitHash) {
      // Single commit diff
      url = `https://api.github.com/repos/${owner}/${repo}/commits/${commitHash}`
    } else if (base && head) {
      // Branch comparison
      url = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`
    } else {
      return Response.json({ error: "Must provide commitHash or base+head" }, { status: 400 })
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      return Response.json({ error: `GitHub API error: ${res.status} ${text}` }, { status: res.status })
    }

    const diff = await res.text()
    return Response.json({ diff })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
