import { prisma } from "@/lib/db/prisma";

import { verifyPassword } from "./password";

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isValid = verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return user;
}
