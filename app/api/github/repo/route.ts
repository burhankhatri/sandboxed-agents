import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const url = new URL(req.url)
  const owner = url.searchParams.get("owner")
  const name = url.searchParams.get("name")

  if (!owner || !name) {
    return badRequest("Missing owner or name")
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const message =
        (errorData as { message?: string }).message ||
        `GitHub API returned ${res.status}`
      return Response.json({ error: message }, { status: res.status })
    }

    const data = await res.json()
    return Response.json({
      name: data.name,
      owner: data.owner.login,
      avatar: data.owner.avatar_url,
      defaultBranch: data.default_branch,
      fullName: data.full_name,
      private: data.private,
    })
  } catch (error: unknown) {
    return internalError(error)
  }
}
