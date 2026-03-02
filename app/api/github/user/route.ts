export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 400 })
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    if (!res.ok) {
      return Response.json({ error: "Invalid token" }, { status: res.status })
    }
    const data = await res.json()
    return Response.json({
      login: data.login,
      avatar: data.avatar_url,
      name: data.name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
