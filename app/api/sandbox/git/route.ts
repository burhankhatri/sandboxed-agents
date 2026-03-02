import { Daytona } from "@daytonaio/sdk"

export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.json()
  const { daytonaApiKey, sandboxId, repoPath, action, githubPat } = body

  if (!daytonaApiKey || !sandboxId || !repoPath || !action) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    const sandbox = await daytona.get(sandboxId)

    switch (action) {
      case "status": {
        const status = await sandbox.git.status(repoPath)
        return Response.json(status)
      }

      case "log": {
        // Use process to get git log since SDK may not expose getCommitHistory directly
        const result = await sandbox.process.executeCommand(
          `cd ${repoPath} && git log --format='{"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","message":"%s","timestamp":"%aI"}' -30 2>&1`
        )
        if (result.exitCode) {
          return Response.json({ commits: [] })
        }
        const commits = result.result
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line: string) => {
            try { return JSON.parse(line) } catch { return null }
          })
          .filter(Boolean)
        return Response.json({ commits })
      }

      case "push": {
        if (!githubPat) {
          return Response.json({ error: "GitHub PAT required for push" }, { status: 400 })
        }
        await sandbox.git.push(repoPath, "x-access-token", githubPat)
        return Response.json({ success: true })
      }

      case "pull": {
        if (!githubPat) {
          return Response.json({ error: "GitHub PAT required for pull" }, { status: 400 })
        }
        await sandbox.git.pull(repoPath, "x-access-token", githubPat)
        return Response.json({ success: true })
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
