"use server";

import { redirect } from "next/navigation";

import { authenticateUser } from "@/lib/auth/authenticate";
import { clearUserSession, createUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultOrganizationForUser } from "@/lib/platform/modules";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let user = null;

  try {
    user = await authenticateUser(email, password);
  } catch {
    redirect("/login?error=setup_required");
  }

  if (!user) {
    redirect("/login?error=invalid_credentials");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  let activeOrganizationId = "legacy-org";

  try {
    const activeMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        organization: {
          isActive: true,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        organizationId: true,
      },
    });

    activeOrganizationId = activeMembership
      ? activeMembership.organizationId
      : (
          await prisma.$transaction(async (tx) => {
            const organization = await ensureDefaultOrganizationForUser(tx, {
              id: user.id,
              role: user.role,
            });
            return organization.id;
          })
        );
  } catch (error) {
    console.warn("Tenant bootstrap tables are unavailable, using legacy session fallback.", error);
  }

  await createUserSession({
    userId: user.id,
    email: user.email,
    role: user.role,
    activeOrgId: activeOrganizationId,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearUserSession();
  redirect("/login");
}
