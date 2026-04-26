"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { hashPassword } from "@/lib/auth/password";
import { requireUserSession } from "@/lib/auth/session";
import {
  canCreateUsers,
  canDeleteUsers,
  canEditUsers,
  canManageTargetUser,
  canToggleUsers,
  isProtectedSuperadmin,
} from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function getRequiredValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`Falta el campo ${key}.`);
  }

  return value;
}

function getRoleValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (value === "SUPERADMIN" || value === "SUPERUSER") {
    return value satisfies UserRole;
  }

  return "ADMIN" satisfies UserRole;
}

async function getCurrentUser() {
  const session = await requireUserSession();
  const currentUser = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
  });

  return currentUser;
}

export async function createUserAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!canCreateUsers(currentUser.role)) {
    throw new Error("Tu perfil no puede crear usuarios.");
  }

  const name = getRequiredValue(formData, "name");
  const email = normalizeEmail(formData.get("email"));
  const password = getRequiredValue(formData, "password");
  const role = getRoleValue(formData, "role");

  if (!email) {
    throw new Error("Falta el email.");
  }

  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  if (currentUser.role !== "SUPERADMIN" && role === "SUPERADMIN") {
    throw new Error("Solo Kevin puede crear superadmins.");
  }

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
    },
  });

  revalidatePath("/users");
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!canEditUsers(currentUser.role)) {
    throw new Error("Tu perfil no puede editar usuarios.");
  }

  const userId = getRequiredValue(formData, "userId");
  const name = getRequiredValue(formData, "name");
  const email = normalizeEmail(formData.get("email"));
  const role = getRoleValue(formData, "role");
  const password = String(formData.get("password") ?? "").trim();

  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (!canManageTargetUser(currentUser.role, targetUser.role)) {
    throw new Error("No puedes editar este perfil.");
  }

  if (isProtectedSuperadmin(targetUser.email) && currentUser.id !== targetUser.id) {
    throw new Error("El perfil de Kevin solo puede editarlo Kevin.");
  }

  if (currentUser.role !== "SUPERADMIN" && role === "SUPERADMIN") {
    throw new Error("Solo Kevin puede asignar el rol Superadmin.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role,
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    },
  });

  revalidatePath("/users");
}

export async function toggleUserAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!canToggleUsers(currentUser.role)) {
    throw new Error("Tu perfil no puede activar o desactivar usuarios.");
  }

  const userId = getRequiredValue(formData, "userId");
  const nextState = String(formData.get("nextState")) === "true";

  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (!canManageTargetUser(currentUser.role, targetUser.role)) {
    throw new Error("No puedes cambiar el estado de este perfil.");
  }

  if (targetUser.id === currentUser.id && !nextState) {
    throw new Error("No puedes desactivar tu propio acceso.");
  }

  if (isProtectedSuperadmin(targetUser.email) && !nextState) {
    throw new Error("Kevin no se puede desactivar desde la interfaz.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: nextState },
  });

  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!canDeleteUsers(currentUser.role)) {
    throw new Error("Tu perfil no puede eliminar usuarios.");
  }

  const userId = getRequiredValue(formData, "userId");
  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      sales: { select: { id: true }, take: 1 },
      inventoryEntries: { select: { id: true }, take: 1 },
      purchaseOrders: { select: { id: true }, take: 1 },
      stockMovements: { select: { id: true }, take: 1 },
    },
  });

  if (!canManageTargetUser(currentUser.role, targetUser.role)) {
    throw new Error("No puedes eliminar este perfil.");
  }

  if (targetUser.id === currentUser.id) {
    throw new Error("No puedes eliminar tu propio usuario.");
  }

  if (isProtectedSuperadmin(targetUser.email)) {
    throw new Error("Kevin no se puede eliminar desde la interfaz.");
  }

  if (
    targetUser.sales.length > 0 ||
    targetUser.inventoryEntries.length > 0 ||
    targetUser.purchaseOrders.length > 0 ||
    targetUser.stockMovements.length > 0
  ) {
    throw new Error("Este usuario ya tiene actividad registrada y no se puede borrar.");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/users");
}
