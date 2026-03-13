import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const { owner, name } = body

  if (!owner || !name) {
    return badRequest("Missing required fields")
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/forks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
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
    return internalError(error)
  }
}
