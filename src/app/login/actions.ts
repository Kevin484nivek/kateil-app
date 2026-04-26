"use server";

import { redirect } from "next/navigation";

import { authenticateUser } from "@/lib/auth/authenticate";
import { clearUserSession, createUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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

  await createUserSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearUserSession();
  redirect("/login");
}
