# Sandboxed Agents: The Ultimate Monorepo Refactoring Plan

## Executive Summary

This document outlines a comprehensive plan to transform the Sandboxed Agents repository into the best-structured, most elegant, and highly maintainable monorepo possible. The refactoring focuses on **separation of concerns**, **domain-driven design**, **scalability**, and **developer experience**.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Vision & Principles](#2-vision--principles)
3. [Target Architecture](#3-target-architecture)
4. [Package Structure](#4-package-structure)
5. [Detailed Refactoring Plan](#5-detailed-refactoring-plan)
6. [Implementation Phases](#6-implementation-phases)
7. [Tooling & Infrastructure](#7-tooling--infrastructure)
8. [Migration Strategy](#8-migration-strategy)

---

## 1. Current State Analysis

### What We Have

```
sandboxed-agents/
├── packages/
│   ├── background-agents/    # SDK for agent execution (well-organized)
│   └── web/                  # Monolithic Next.js app (needs refactoring)
├── package.json              # Root workspace config
└── vercel.json               # Deployment config
```

### Current Strengths
- ✅ Clean SDK package with provider abstraction
- ✅ Working npm workspaces setup
- ✅ Good Prisma schema design
- ✅ Security-first credential handling
- ✅ Comprehensive feature set

### Current Pain Points
- ❌ Web package is monolithic with mixed concerns
- ❌ `/lib` directory has 34 files with no organization
- ❌ No shared types package between SDK and web
- ❌ No shared UI components package
- ❌ No build orchestration (sequential builds only)
- ❌ Tests only in SDK, none for web
- ❌ API routes mix validation, auth, business logic, and DB
- ❌ Inconsistent import paths and conventions

---

## 2. Vision & Principles

### The Vision
Create a monorepo that is:
- **Self-documenting** - Structure tells the story
- **Scalable** - Easy to add new packages/features
- **Developer-friendly** - Fast builds, clear conventions
- **Testable** - Every layer can be tested in isolation
- **Maintainable** - Clear ownership and boundaries

### Design Principles

1. **Vertical Slice Architecture**
   - Features are self-contained units
   - Each domain owns its types, logic, and tests

2. **Dependency Inversion**
   - Core business logic has no framework dependencies
   - Adapters connect to external systems

3. **Explicit Over Implicit**
   - Clear exports and contracts
   - No magic, everything is traceable

4. **Progressive Disclosure**
   - Simple things stay simple
   - Complexity is opt-in

5. **Type Safety First**
   - Shared types prevent drift
   - Zod schemas for runtime validation

---

## 3. Target Architecture

### High-Level Package Graph

```
                    ┌─────────────────────────────────────────┐
                    │              @sandboxed/web              │
                    │          (Next.js Application)           │
                    └──────┬──────────┬──────────┬────────────┘
                           │          │          │
           ┌───────────────┴──────┐   │   ┌──────┴───────────────┐
           │                      │   │   │                      │
           ▼                      ▼   │   ▼                      │
    ┌────────────┐         ┌──────────┴──────────┐        ┌────────────┐
    │ @sandboxed │         │    @sandboxed/api   │        │ @sandboxed │
    │    /ui     │         │  (API Layer/Routes) │        │ /features  │
    └────────────┘         └──────────┬──────────┘        └─────┬──────┘
                                      │                         │
                    ┌─────────────────┼─────────────────────────┘
                    │                 │
                    ▼                 ▼
           ┌────────────────┐  ┌────────────────┐
           │  @sandboxed/   │  │  @sandboxed/   │
           │    services    │  │     agents     │
           │  (Core Logic)  │  │  (Agent SDK)   │
           └───────┬────────┘  └────────┬───────┘
                   │                    │
           ┌───────┴────────────────────┤
           │                            │
           ▼                            ▼
    ┌────────────┐              ┌────────────────┐
    │ @sandboxed │              │  @sandboxed/   │
    │  /database │              │   providers    │
    └────────────┘              └────────────────┘
           │                            │
           └───────────┬────────────────┘
                       ▼
               ┌────────────┐
               │ @sandboxed │
               │   /types   │
               └────────────┘
               ┌────────────┐
               │ @sandboxed │
               │   /config  │
               └────────────┘
```

---

## 4. Package Structure

### Target Directory Structure

```
sandboxed-agents/
├── apps/
│   └── web/                          # Next.js application (thin layer)
│       ├── app/                      # App router pages only
│       ├── public/
│       └── package.json
│
├── packages/
│   ├── agents/                       # Renamed from background-agents
│   │   ├── src/
│   │   │   ├── providers/            # Claude, Codex, OpenCode, Gemini
│   │   │   ├── sandbox/              # Daytona integration
│   │   │   ├── session/              # Session management
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/                          # API route handlers (extracted)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── agent/            # /api/agent/*
│   │   │   │   ├── auth/             # /api/auth/*
│   │   │   │   ├── branches/         # /api/branches/*
│   │   │   │   ├── github/           # /api/github/*
│   │   │   │   ├── repos/            # /api/repos/*
│   │   │   │   ├── sandbox/          # /api/sandbox/*
│   │   │   │   └── user/             # /api/user/*
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Authentication middleware
│   │   │   │   ├── validation.ts     # Request validation
│   │   │   │   └── error-handler.ts  # Error handling
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── config/                       # Shared configuration
│   │   ├── src/
│   │   │   ├── env.ts                # Environment validation
│   │   │   ├── constants.ts          # App constants
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── database/                     # Database layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts             # Prisma client singleton
│   │   │   ├── repositories/         # Data access layer
│   │   │   │   ├── user.repository.ts
│   │   │   │   ├── repo.repository.ts
│   │   │   │   ├── branch.repository.ts
│   │   │   │   ├── sandbox.repository.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── features/                     # Feature modules (vertical slices)
│   │   ├── src/
│   │   │   ├── chat/                 # Chat feature
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── utils/
│   │   │   │   └── index.ts
│   │   │   ├── git/                  # Git feature
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── actions/
│   │   │   │   └── index.ts
│   │   │   ├── repository/           # Repository management
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   └── index.ts
│   │   │   ├── settings/             # User/repo settings
│   │   │   │   ├── components/
│   │   │   │   └── index.ts
│   │   │   └── mcp/                  # MCP integration
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       └── index.ts
│   │   └── package.json
│   │
│   ├── providers/                    # External service adapters
│   │   ├── src/
│   │   │   ├── github/               # GitHub API client
│   │   │   ├── daytona/              # Daytona SDK wrapper
│   │   │   ├── llm/                  # LLM providers (Anthropic, OpenAI)
│   │   │   ├── mcp/                  # MCP registry/OAuth
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── services/                     # Business logic layer
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── agent.service.ts
│   │   │   │   ├── session.service.ts
│   │   │   │   └── index.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── encryption.service.ts
│   │   │   │   └── index.ts
│   │   │   ├── git/
│   │   │   │   ├── git.service.ts
│   │   │   │   ├── branch.service.ts
│   │   │   │   └── index.ts
│   │   │   ├── sandbox/
│   │   │   │   ├── sandbox.service.ts
│   │   │   │   ├── quota.service.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── types/                        # Shared type definitions
│   │   ├── src/
│   │   │   ├── agent.types.ts
│   │   │   ├── api.types.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── database.types.ts
│   │   │   ├── events.types.ts
│   │   │   ├── github.types.ts
│   │   │   ├── mcp.types.ts
│   │   │   ├── sandbox.types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                           # Shared UI components
│   │   ├── src/
│   │   │   ├── primitives/           # Shadcn/Radix primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown.tsx
│   │   │   │   └── ...
│   │   │   ├── patterns/             # Composed patterns
│   │   │   │   ├── data-table.tsx
│   │   │   │   ├── form-field.tsx
│   │   │   │   ├── empty-state.tsx
│   │   │   │   └── ...
│   │   │   ├── icons/                # Custom icons
│   │   │   ├── styles/
│   │   │   │   └── globals.css
│   │   │   └── index.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── utils/                        # Shared utilities
│       ├── src/
│       │   ├── cn.ts                 # className merger
│       │   ├── date.ts               # Date utilities
│       │   ├── string.ts             # String utilities
│       │   ├── validation.ts         # Common validators
│       │   ├── sse.ts                # Server-sent events
│       │   └── index.ts
│       └── package.json
│
├── tooling/                          # Development tooling configs
│   ├── eslint/
│   │   └── base.js
│   ├── typescript/
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── library.json
│   └── tailwind/
│       └── base.config.ts
│
├── turbo.json                        # Turborepo configuration
├── package.json                      # Root workspace
├── pnpm-workspace.yaml               # PNPM workspaces (recommended)
└── README.md
```

---

## 5. Detailed Refactoring Plan

### Phase 1: Foundation & Tooling

#### 1.1 Migrate to PNPM + Turborepo

**Why PNPM?**
- Faster installs (symlinked node_modules)
- Strict dependency resolution
- Better disk space usage
- Superior monorepo support

**Why Turborepo?**
- Intelligent caching (local + remote)
- Parallel task execution
- Dependency-aware builds
- Incremental builds

**Implementation:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tooling/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

#### 1.2 Shared TypeScript Configuration

```
tooling/typescript/
├── base.json          # Shared strict settings
├── nextjs.json        # Next.js app settings (extends base)
└── library.json       # Library package settings (extends base)
```

**base.json:**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### 1.3 Shared ESLint Configuration

```javascript
// tooling/eslint/base.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/order': ['error', { 'newlines-between': 'always' }],
    'import/no-cycle': 'error'
  }
};
```

---

### Phase 2: Create Core Packages

#### 2.1 @sandboxed/types

Extract all shared type definitions into a single source of truth.

```typescript
// packages/types/src/agent.types.ts
export type AgentType = 'claude' | 'codex' | 'opencode' | 'gemini';
export type AgentModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-3-7-sonnet-20250219'
  | 'gpt-4.1'
  | 'o4-mini'
  | 'gemini-2.5-pro';

export interface AgentSession {
  id: string;
  agentType: AgentType;
  model: AgentModel;
  sandboxId: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AgentExecutionResult {
  id: string;
  sessionId: string;
  query: string;
  response: string;
  loopCount: number;
  startedAt: Date;
  completedAt: Date;
  status: 'success' | 'error' | 'timeout';
}

// packages/types/src/events.types.ts
export type AgentEventType =
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'completion'
  | 'error'
  | 'progress'
  | 'thinking';

export interface BaseAgentEvent {
  type: AgentEventType;
  timestamp: number;
}

export interface TextEvent extends BaseAgentEvent {
  type: 'text';
  content: string;
}

export interface ToolUseEvent extends BaseAgentEvent {
  type: 'tool_use';
  toolName: string;
  input: Record<string, unknown>;
  toolUseId: string;
}

// ... etc

export type AgentEvent = TextEvent | ToolUseEvent | /* ... */;
```

#### 2.2 @sandboxed/config

Centralized, validated environment configuration.

```typescript
// packages/config/src/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Authentication
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),

  // API Keys
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DAYTONA_API_KEY: z.string(),
  DAYTONA_SERVER_URL: z.string().url(),

  // Security
  ENCRYPTION_KEY: z.string().min(32),

  // Optional
  SMITHERY_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  // Feature flags
  DEV_MODE: z.coerce.boolean().default(false),
  ENABLE_ADMIN_PANEL: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const env = validateEnv();
```

#### 2.3 @sandboxed/utils

Common utilities shared across all packages.

```typescript
// packages/utils/src/index.ts
export * from './cn';
export * from './date';
export * from './string';
export * from './validation';
export * from './sse';
export * from './result';

// packages/utils/src/result.ts
// Result pattern for explicit error handling
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),
  err: <E>(error: E): Result<never, E> => ({ ok: false, error }),

  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
    result.ok ? Result.ok(fn(result.value)) : result,

  flatMap: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> =>
    result.ok ? fn(result.value) : result,
};
```

---

### Phase 3: Database Layer

#### 3.1 @sandboxed/database

Move Prisma to its own package with repository pattern.

```typescript
// packages/database/src/repositories/base.repository.ts
import type { PrismaClient } from '@prisma/client';

export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaClient) {}
}

// packages/database/src/repositories/repo.repository.ts
import type { Prisma, Repo } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class RepoRepository extends BaseRepository {
  async findByUserId(userId: string): Promise<Repo[]> {
    return this.prisma.repo.findMany({
      where: { userId },
      include: {
        branches: true,
        mcpServers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByFullName(
    userId: string,
    owner: string,
    name: string
  ): Promise<Repo | null> {
    return this.prisma.repo.findFirst({
      where: { userId, owner, name },
      include: {
        branches: {
          include: { sandbox: true },
        },
        mcpServers: true,
      },
    });
  }

  async create(data: Prisma.RepoCreateInput): Promise<Repo> {
    return this.prisma.repo.create({ data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.repo.delete({ where: { id } });
  }
}

// packages/database/src/index.ts
export { prisma } from './client';
export { RepoRepository } from './repositories/repo.repository';
export { UserRepository } from './repositories/user.repository';
export { BranchRepository } from './repositories/branch.repository';
export { SandboxRepository } from './repositories/sandbox.repository';
export { MessageRepository } from './repositories/message.repository';

// Re-export Prisma types
export type { User, Repo, Branch, Sandbox, Message } from '@prisma/client';
```

---

### Phase 4: Service Layer

#### 4.1 @sandboxed/services

Pure business logic with no framework dependencies.

```typescript
// packages/services/src/sandbox/sandbox.service.ts
import type { SandboxRepository } from '@sandboxed/database';
import type { DaytonaProvider } from '@sandboxed/providers';
import type { CreateSandboxParams, Sandbox } from '@sandboxed/types';
import { Result } from '@sandboxed/utils';

export class SandboxService {
  constructor(
    private readonly sandboxRepo: SandboxRepository,
    private readonly daytona: DaytonaProvider,
    private readonly quotaService: QuotaService,
  ) {}

  async createSandbox(
    userId: string,
    params: CreateSandboxParams
  ): Promise<Result<Sandbox, SandboxError>> {
    // Check quota
    const quotaResult = await this.quotaService.checkQuota(userId);
    if (!quotaResult.ok) {
      return Result.err(new SandboxError('QUOTA_EXCEEDED', quotaResult.error));
    }

    // Create Daytona sandbox
    const daytonaResult = await this.daytona.createSandbox({
      image: params.image ?? 'daytonaio/ai-sandbox:latest',
      env: params.environmentVariables,
    });

    if (!daytonaResult.ok) {
      return Result.err(new SandboxError('CREATION_FAILED', daytonaResult.error));
    }

    // Clone repository
    const cloneResult = await this.daytona.cloneRepo(
      daytonaResult.value.id,
      params.repoUrl,
      params.branch
    );

    if (!cloneResult.ok) {
      await this.daytona.deleteSandbox(daytonaResult.value.id);
      return Result.err(new SandboxError('CLONE_FAILED', cloneResult.error));
    }

    // Persist to database
    const sandbox = await this.sandboxRepo.create({
      daytonaSandboxId: daytonaResult.value.id,
      userId,
      branchId: params.branchId,
      status: 'running',
    });

    return Result.ok(sandbox);
  }

  async stopSandbox(sandboxId: string): Promise<Result<void, SandboxError>> {
    // Implementation
  }

  async resumeSandbox(sandboxId: string): Promise<Result<Sandbox, SandboxError>> {
    // Implementation
  }
}

// packages/services/src/sandbox/quota.service.ts
export class QuotaService {
  constructor(private readonly userRepo: UserRepository) {}

  async checkQuota(userId: string): Promise<Result<QuotaInfo, QuotaError>> {
    const user = await this.userRepo.findById(userId);
    const activeSandboxes = await this.sandboxRepo.countActive(userId);

    const limit = user?.sandboxQuota ?? 3;

    if (activeSandboxes >= limit) {
      return Result.err(new QuotaError(`Limit of ${limit} sandboxes reached`));
    }

    return Result.ok({
      used: activeSandboxes,
      limit,
      remaining: limit - activeSandboxes,
    });
  }
}
```

---

### Phase 5: API Layer

#### 5.1 @sandboxed/api

Extracted API route handlers with proper middleware.

```typescript
// packages/api/src/middleware/auth.ts
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import type { AuthUser } from '@sandboxed/types';

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const session = await getServerSession();

  if (!session?.user?.id) {
    throw new UnauthorizedError('Authentication required');
  }

  return session.user as AuthUser;
}

export function withAuth<T>(
  handler: (req: NextRequest, user: AuthUser) => Promise<T>
) {
  return async (req: NextRequest) => {
    const user = await requireAuth(req);
    return handler(req, user);
  };
}

// packages/api/src/middleware/validation.ts
import type { ZodSchema } from 'zod';

export function withValidation<T>(schema: ZodSchema<T>) {
  return async (req: NextRequest): Promise<T> => {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error);
    }

    return result.data;
  };
}

// packages/api/src/routes/sandbox/create.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, withValidation } from '../../middleware';
import { sandboxService } from '@sandboxed/services';

const createSandboxSchema = z.object({
  repoId: z.string(),
  branchId: z.string(),
  agentType: z.enum(['claude', 'codex', 'opencode', 'gemini']),
  model: z.string().optional(),
});

export const POST = withAuth(async (req, user) => {
  const body = await withValidation(createSandboxSchema)(req);

  const result = await sandboxService.createSandbox(user.id, {
    repoId: body.repoId,
    branchId: body.branchId,
    agentType: body.agentType,
    model: body.model,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.statusCode }
    );
  }

  return NextResponse.json(result.value);
});
```

---

### Phase 6: Feature Packages

#### 6.1 @sandboxed/features

Vertical slices containing all UI for a feature.

```typescript
// packages/features/src/chat/components/chat-panel.tsx
'use client';

import { useChatMessages, useChatInput, useChatStreaming } from '../hooks';
import { MessageList, MessageInput, TypingIndicator } from './';
import { Panel, ScrollArea } from '@sandboxed/ui';

export interface ChatPanelProps {
  branchId: string;
  sandboxId: string;
}

export function ChatPanel({ branchId, sandboxId }: ChatPanelProps) {
  const { messages, isLoading } = useChatMessages(branchId);
  const { input, setInput, submit, isSubmitting } = useChatInput(sandboxId);
  const { streamingContent, isStreaming } = useChatStreaming(sandboxId);

  return (
    <Panel className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <MessageList messages={messages} isLoading={isLoading} />
        {isStreaming && <TypingIndicator content={streamingContent} />}
      </ScrollArea>

      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={submit}
        disabled={isSubmitting || isStreaming}
      />
    </Panel>
  );
}

// packages/features/src/chat/hooks/use-chat-messages.ts
import useSWR from 'swr';
import type { Message } from '@sandboxed/types';

export function useChatMessages(branchId: string) {
  const { data, error, isLoading, mutate } = useSWR<Message[]>(
    branchId ? `/api/branches/${branchId}/messages` : null
  );

  return {
    messages: data ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}

// packages/features/src/chat/index.ts
// Public API for the chat feature
export { ChatPanel } from './components/chat-panel';
export { useChatMessages, useChatInput, useChatStreaming } from './hooks';
export type { ChatMessage, ChatState } from './types';
```

#### 6.2 @sandboxed/ui

Shared UI component library.

```typescript
// packages/ui/src/primitives/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@sandboxed/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };

// packages/ui/src/index.ts
// Primitives
export * from './primitives/button';
export * from './primitives/dialog';
export * from './primitives/dropdown';
// ... etc

// Patterns
export * from './patterns/data-table';
export * from './patterns/empty-state';
export * from './patterns/form-field';
// ... etc

// Icons
export * from './icons';
```

---

### Phase 7: Providers Package

#### 7.1 @sandboxed/providers

External service adapters with consistent interfaces.

```typescript
// packages/providers/src/github/github.provider.ts
import type { Result } from '@sandboxed/utils';
import type {
  GitHubRepo,
  GitHubBranch,
  GitHubPullRequest,
  CreatePRParams
} from '@sandboxed/types';

export class GitHubProvider {
  constructor(private readonly accessToken: string) {}

  async listRepos(): Promise<Result<GitHubRepo[], GitHubError>> {
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        return Result.err(new GitHubError('FETCH_REPOS_FAILED', response.status));
      }

      const repos = await response.json();
      return Result.ok(repos);
    } catch (error) {
      return Result.err(new GitHubError('NETWORK_ERROR', error));
    }
  }

  async createPullRequest(params: CreatePRParams): Promise<Result<GitHubPullRequest, GitHubError>> {
    // Implementation
  }

  async getBranches(owner: string, repo: string): Promise<Result<GitHubBranch[], GitHubError>> {
    // Implementation
  }
}

// packages/providers/src/daytona/daytona.provider.ts
import { Daytona } from '@daytonaio/sdk';
import type { Result } from '@sandboxed/utils';
import type { SandboxInstance, CreateSandboxOptions } from '@sandboxed/types';

export class DaytonaProvider {
  private client: Daytona;

  constructor(apiKey: string, serverUrl: string) {
    this.client = new Daytona({ apiKey, serverUrl });
  }

  async createSandbox(options: CreateSandboxOptions): Promise<Result<SandboxInstance, DaytonaError>> {
    try {
      const sandbox = await this.client.create(options);
      return Result.ok(sandbox);
    } catch (error) {
      return Result.err(new DaytonaError('CREATE_FAILED', error));
    }
  }

  async executeCommand(
    sandboxId: string,
    command: string
  ): Promise<Result<string, DaytonaError>> {
    // Implementation
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Migrate from npm to pnpm
- [ ] Add Turborepo configuration
- [ ] Set up shared TypeScript configs
- [ ] Set up shared ESLint configs
- [ ] Create `@sandboxed/types` package
- [ ] Create `@sandboxed/config` package
- [ ] Create `@sandboxed/utils` package

### Phase 2: Infrastructure (Week 2-3)
- [ ] Move Prisma to `@sandboxed/database`
- [ ] Implement repository pattern
- [ ] Create `@sandboxed/providers` package
- [ ] Extract GitHub provider
- [ ] Extract Daytona provider
- [ ] Extract LLM providers

### Phase 3: Business Logic (Week 3-4)
- [ ] Create `@sandboxed/services` package
- [ ] Extract SandboxService
- [ ] Extract AgentService
- [ ] Extract GitService
- [ ] Extract AuthService
- [ ] Add unit tests for services

### Phase 4: API Layer (Week 4-5)
- [ ] Create `@sandboxed/api` package
- [ ] Extract middleware (auth, validation, error handling)
- [ ] Migrate route handlers
- [ ] Add API integration tests
- [ ] Update app routes to use new API package

### Phase 5: UI Layer (Week 5-6)
- [ ] Create `@sandboxed/ui` package
- [ ] Move shadcn primitives
- [ ] Create pattern components
- [ ] Move icons
- [ ] Add Storybook for documentation

### Phase 6: Features (Week 6-8)
- [ ] Create `@sandboxed/features` package
- [ ] Extract chat feature
- [ ] Extract git feature
- [ ] Extract repository feature
- [ ] Extract settings feature
- [ ] Extract MCP feature

### Phase 7: App Cleanup (Week 8-9)
- [ ] Move app to `apps/web`
- [ ] Slim down to pages + layouts only
- [ ] Update all imports
- [ ] Remove old lib/ directory
- [ ] Clean up old components/

### Phase 8: Testing & Polish (Week 9-10)
- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] CI/CD pipeline updates

---

## 7. Tooling & Infrastructure

### Build Pipeline (turbo.json)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL"],
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "outputs": ["playwright-report/**"],
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Turbo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
          restore-keys: turbo-

      - name: Build
        run: pnpm turbo build

      - name: Lint
        run: pnpm turbo lint

      - name: Type check
        run: pnpm turbo typecheck

      - name: Test
        run: pnpm turbo test
```

### Remote Caching (Vercel)

```bash
# Enable remote caching for team
npx turbo login
npx turbo link
```

---

## 8. Migration Strategy

### Approach: Strangler Fig Pattern

Rather than a big-bang rewrite, we'll incrementally extract packages while keeping the app working.

1. **Create new packages alongside existing code**
2. **Migrate one module at a time**
3. **Update imports to use new packages**
4. **Delete old code when all consumers migrated**
5. **Repeat for each module**

### Step-by-Step Migration Example (Services)

**Step 1:** Create `@sandboxed/services` with empty exports
```typescript
// packages/services/src/index.ts
export {};
```

**Step 2:** Create SandboxService in new package
```typescript
// packages/services/src/sandbox/sandbox.service.ts
export class SandboxService {
  // New implementation
}
```

**Step 3:** Update web app to use new service
```typescript
// Before (in route handler)
import { createSandbox } from '@/lib/sandbox-utils';

// After
import { sandboxService } from '@sandboxed/services';
```

**Step 4:** Remove old code
```bash
rm packages/web/lib/sandbox-utils.ts
```

**Step 5:** Repeat for next module

---

## Summary

This refactoring plan transforms the Sandboxed Agents repository from a working but monolithic codebase into a well-structured, scalable monorepo with:

- **10 focused packages** with clear responsibilities
- **Proper separation of concerns** (UI, API, services, database, providers)
- **Shared types and utilities** preventing drift
- **Modern tooling** (pnpm + Turborepo) for fast builds
- **Comprehensive test coverage** at each layer
- **Clear migration path** using the Strangler Fig pattern

The end result will be a codebase that is:
- Self-documenting through structure
- Easy to onboard new developers
- Fast to build and test
- Simple to extend with new features
- Maintainable for years to come

---

*Generated for Sandboxed Agents Monorepo Refactoring*
