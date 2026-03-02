export async function POST(req: Request) {
  const body = await req.json()
  const { token, owner, name } = body

  if (!token || !owner || !name) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/forks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message = (data as { message?: string }).message || `Fork failed (${res.status})`
      return Response.json({ error: message }, { status: res.status })
    }

    const data = await res.json()
    return Response.json({
      name: data.name,
      owner: data.owner.login,
      avatar: data.owner.avatar_url,
      defaultBranch: data.default_branch,
      fullName: data.full_name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
