import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const { name, description, isPrivate } = body

  if (!name) {
    return badRequest("Missing required fields")
  }

  try {
    const res = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: description || undefined,
        private: isPrivate ?? false,
        auto_init: true,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error((data as { message?: string }).message || `GitHub API error: ${res.status}`)
    }

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
