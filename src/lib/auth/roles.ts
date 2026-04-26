import { UserRole } from "@prisma/client";

export const PROTECTED_SUPERADMIN_EMAIL = "kevin.luis.beaumont@gmail.com";

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case "SUPERADMIN":
      return "Superadmin";
    case "SUPERUSER":
      return "Superusuario";
    default:
      return "Admin";
  }
}

export function canCreateUsers(role: UserRole) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canDeleteUsers(role: UserRole) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canToggleUsers(role: UserRole) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "SUPERUSER";
}

export function canEditUsers(role: UserRole) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "SUPERUSER";
}

export function canManageTargetUser(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "SUPERADMIN") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return targetRole !== "SUPERADMIN";
  }

  if (actorRole === "SUPERUSER") {
    return targetRole !== "SUPERADMIN";
  }

  return false;
}

export function isProtectedSuperadmin(email: string) {
  return email.trim().toLowerCase() === PROTECTED_SUPERADMIN_EMAIL;
}
