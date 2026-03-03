export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const owner = searchParams.get("owner")
  const repo = searchParams.get("repo")

  if (!token || !owner || !repo) {
    return Response.json({ error: "Missing required params" }, { status: 400 })
  }

  try {
    const branches: string[] = []
    let page = 1
    while (true) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message || `GitHub API error: ${res.status}`)
      }
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) break
      for (const b of data) {
        branches.push(b.name)
      }
      if (data.length < 100) break
      page++
    }
    return Response.json({ branches })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
