import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function GET(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get("owner")
  const repo = searchParams.get("repo")

  if (!owner || !repo) {
    return badRequest("Missing required params")
  }

  try {
    const branches: string[] = []
    let page = 1
    while (true) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${auth.token}`,
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
    return internalError(error)
  }
}
