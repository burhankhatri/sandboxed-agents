import { requireGitHubAuth, isGitHubAuthError, internalError } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )
    if (!res.ok) {
      return Response.json({ error: "Failed to fetch repos" }, { status: res.status })
    }
    const data = await res.json()
    const repos = data.map((r: Record<string, unknown>) => ({
      fullName: (r as { full_name: string }).full_name,
      name: (r as { name: string }).name,
      owner: ((r as { owner: { login: string } }).owner).login,
      avatar: ((r as { owner: { avatar_url: string } }).owner).avatar_url,
      defaultBranch: (r as { default_branch: string }).default_branch,
      private: (r as { private: boolean }).private,
      description: (r as { description: string | null }).description,
    }))
    return Response.json({ repos })
  } catch (error: unknown) {
    return internalError(error)
  }
}
