import { requireGitHubAuth, isGitHubAuthError, internalError } from "@/lib/api-helpers"

export async function GET() {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${auth.token}`,
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
    return internalError(error)
  }
}
