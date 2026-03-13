import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const { owner, repo, base, head, commitHash } = body

  if (!owner || !repo) {
    return badRequest("Missing required fields")
  }

  const headers = {
    Authorization: `Bearer ${auth.token}`,
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
      return badRequest("Must provide commitHash or base+head")
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      return Response.json({ error: `GitHub API error: ${res.status} ${text}` }, { status: res.status })
    }

    const diff = await res.text()
    return Response.json({ diff })
  } catch (error: unknown) {
    return internalError(error)
  }
}
