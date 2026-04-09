# Plan: Auto-generate English Chat Names with LLM (OpenRouter)

## Goal
Automatically generate human-readable English names for chats using OpenRouter's LLM, based on the user's first message.

## Current State
- `Chat.displayName` field exists but is always `null`
- UI falls back to "Untitled" when `displayName` is null
- OpenRouter API key already configured in environment (`OPENROUTER_API_KEY`)
- Web app already uses OpenRouter with model `openai/gpt-oss-20b`

## Approach
Create a simple API endpoint that uses OpenRouter (same as web app) to generate chat titles. No user API keys needed - uses server-side OpenRouter key.

## Implementation Steps

### Step 1: Create API endpoint for chat name generation
**File:** `packages/simple-chat/app/api/chat/suggest-name/route.ts`

Create a new API endpoint that:
- Accepts `{ prompt: string }`
- Uses AI SDK with OpenRouter (`openai/gpt-oss-20b`) via `createOpenAI` with custom baseURL
- Uses env var `OPENROUTER_API_KEY` (already configured)
- Returns `{ name: string }` or `{ error: string }`

### Step 2: Call the API after first message
**File:** `packages/simple-chat/lib/hooks/useChat.ts`

In the `sendMessage` function:
- Check if this is the first message (before adding user message)
- After successfully starting the agent, call `/api/chat/suggest-name` in background
- On success, update chat with `displayName`

## Files to Create/Modify
1. **Create:** `packages/simple-chat/app/api/chat/suggest-name/route.ts`
2. **Modify:** `packages/simple-chat/lib/hooks/useChat.ts`

## API Endpoint Details

```typescript
// POST /api/chat/suggest-name
// Request: { prompt: string }
// Response: { name: string } or { error: string }

// Uses same config as web app:
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const OPENROUTER_MODEL = "openai/gpt-oss-20b"

const PROMPT = `Generate a short 2-5 word title for this chat request. Reply with just the title, no quotes or extra punctuation.

User's message: {prompt}`
```

## Example Results
| User Prompt | Generated Name |
|-------------|----------------|
| "Build a todo app with React" | "React Todo App" |
| "Help me create a login page" | "Login Page Creation" |
| "Fix the authentication bug" | "Auth Bug Fix" |

## Dependencies
- `ai` package - need to add to simple-chat
- `@ai-sdk/openai` - need to add to simple-chat
