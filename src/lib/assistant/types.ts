import type { UserRole } from "@prisma/client";

export type AssistantProvider = "none" | "openai" | "groq" | "anthropic";

export type AssistantDomain =
  | "knowledge_base"
  | "system_analysis"
  | "products"
  | "sales"
  | "inventory"
  | "suppliers"
  | "customers"
  | "expenses"
  | "users"
  | "storage";

export type AssistantRolePolicy = {
  role: UserRole;
  allowedDomains: AssistantDomain[];
  canRunSystemAnalysis: boolean;
  canSeeStorageConfig: boolean;
  canManageUsers: boolean;
};

export type AssistantRuntimeConfig = {
  provider: AssistantProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export type AssistantMessageInput = {
  message: string;
  pathname?: string | null;
  userId: string;
  userRole: UserRole;
  userEmail: string;
};

export type AssistantKnowledgeSnippet = {
  source: string;
  title: string;
  excerpt: string;
  score: number;
};

export type AssistantAnswer = {
  answer: string;
  provider: AssistantProvider;
  model: string;
  usedFallback: boolean;
  snippets: Array<{
    source: string;
    title: string;
  }>;
};
