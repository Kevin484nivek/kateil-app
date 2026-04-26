import type { OrganizationModuleKey, Prisma, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import type { SessionPayload } from "@/lib/auth/session";

export const DEFAULT_ENABLED_MODULE_KEYS: OrganizationModuleKey[] = [
  "CATALOG_CORE",
  "STOCK_CORE",
  "SALES_CORE",
  "MERCHANDISE_CORE",
  "SEARCH_CORE",
  "CUSTOMERS_PLUS",
  "SUPPLIERS_PLUS",
  "INVENTORY_PLUS",
  "EXPENSES_PLUS",
  "ANALYTICS_PLUS",
];

function resolveMembershipRole(userRole: UserRole) {
  if (userRole === "SUPERADMIN") {
    return "OWNER" as const;
  }

  if (userRole === "ADMIN") {
    return "ADMIN" as const;
  }

  return "MEMBER" as const;
}

export async function ensureDefaultModulesForOrganization(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  for (const moduleKey of DEFAULT_ENABLED_MODULE_KEYS) {
    await tx.organizationModule.upsert({
      where: {
        organizationId_moduleKey: {
          organizationId,
          moduleKey,
        },
      },
      update: {},
      create: {
        organizationId,
        moduleKey,
        isEnabled: true,
      },
    });
  }
}

export async function ensureDefaultOrganizationForUser(
  tx: Prisma.TransactionClient,
  user: { id: string; role: UserRole },
) {
  const defaultOrgSlug = "kateil-base";

  const organization = await tx.organization.upsert({
    where: { slug: defaultOrgSlug },
    update: {},
    create: {
      slug: defaultOrgSlug,
      name: "Kateil Base",
      isActive: true,
    },
  });

  await tx.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      isActive: true,
      role: resolveMembershipRole(user.role),
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      isActive: true,
      role: resolveMembershipRole(user.role),
    },
  });

  await ensureDefaultModulesForOrganization(tx, organization.id);

  return organization;
}

export async function isModuleEnabledForOrganization(
  organizationId: string,
  moduleKey: OrganizationModuleKey,
) {
  try {
    const organizationModule = await prisma.organizationModule.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId,
          moduleKey,
        },
      },
      select: { isEnabled: true },
    });

    return organizationModule?.isEnabled === true;
  } catch (error) {
    console.warn("Falling back to permissive module access while tenant tables are unavailable.", error);
    return true;
  }
}

export async function requireModuleAccess(session: SessionPayload, moduleKey: OrganizationModuleKey) {
  const enabled = await isModuleEnabledForOrganization(session.activeOrgId, moduleKey);

  if (!enabled) {
    redirect("/dashboard?error=module_disabled");
  }
}

export async function assertModuleAccess(session: SessionPayload, moduleKey: OrganizationModuleKey) {
  const enabled = await isModuleEnabledForOrganization(session.activeOrgId, moduleKey);

  if (!enabled) {
    throw new Error("Módulo no activo para la organización actual.");
  }
}
