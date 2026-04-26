import type { UserRole } from "@prisma/client";

import { canCreateUsers, canEditUsers } from "@/lib/auth/roles";

import type { AssistantRolePolicy } from "./types";

const BASE_DOMAINS = [
  "knowledge_base",
  "system_analysis",
  "products",
  "sales",
  "inventory",
  "suppliers",
  "customers",
  "expenses",
] as const;

export function getAssistantRolePolicy(role: UserRole): AssistantRolePolicy {
  const canManageUsers = canEditUsers(role);
  const canSeeStorageConfig = canEditUsers(role);
  const canRunSystemAnalysis = true;

  const allowedDomains = [
    ...BASE_DOMAINS,
    ...(canManageUsers ? (["users"] as const) : []),
    ...(canSeeStorageConfig ? (["storage"] as const) : []),
  ];

  return {
    role,
    allowedDomains,
    canRunSystemAnalysis,
    canSeeStorageConfig,
    canManageUsers: canManageUsers && canCreateUsers(role),
  };
}

