"use server";

import {
  StorageConnectionStatus,
  StorageProvider,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserSession } from "@/lib/auth/session";
import { canEditUsers } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { extractGoogleDriveFolderId } from "@/lib/storage/google-drive";
import { validateAndSyncGoogleDriveIntegration } from "@/lib/storage/google-drive-integration";
import { STORAGE_FOLDER_BLUEPRINTS } from "@/lib/storage/settings";
import { getOptionalString } from "@/lib/utils/form";

function parseProvider(formData: FormData) {
  const value = getOptionalString(formData, "provider") ?? StorageProvider.GOOGLE_DRIVE;

  if (!Object.values(StorageProvider).includes(value as StorageProvider)) {
    throw new Error("Proveedor de almacenamiento no válido");
  }

  return value as StorageProvider;
}

export async function saveStorageSettingsAction(formData: FormData) {
  const session = await requireUserSession();
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!currentUser || !canEditUsers(currentUser.role)) {
    throw new Error("No tienes permisos para editar almacenamiento");
  }

  const provider = parseProvider(formData);
  const existing = await prisma.storageIntegrationSetting.findFirst({
    include: {
      folders: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const connectedAccountEmail = existing?.connectedAccountEmail ?? null;
  const rootFolderName = existing?.rootFolderName ?? "Kateil";
  const rootFolderUrl = getOptionalString(formData, "rootFolderUrl");
  const rootFolderId = extractGoogleDriveFolderId(rootFolderUrl);
  const notes = getOptionalString(formData, "notes");

  const rootStatus =
    connectedAccountEmail || rootFolderId || rootFolderUrl
      ? StorageConnectionStatus.PENDING
      : StorageConnectionStatus.NOT_CONNECTED;

  await prisma.$transaction(async (tx) => {
    const existingInTx = await tx.storageIntegrationSetting.findFirst({
      include: {
        folders: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const integration = existingInTx
      ? await tx.storageIntegrationSetting.update({
          where: { id: existingInTx.id },
          data: {
            provider,
            status:
              existingInTx.oauthRefreshToken || existingInTx.oauthAccessToken
                ? StorageConnectionStatus.PENDING
                : rootStatus,
            connectedAccountEmail,
            rootFolderName,
            rootFolderId,
            rootFolderUrl,
            notes,
            lastValidatedAt: null,
          },
        })
      : await tx.storageIntegrationSetting.create({
          data: {
            provider,
            status: rootStatus,
            connectedAccountEmail,
            rootFolderName,
            rootFolderId,
            rootFolderUrl,
            notes,
          },
      });

    for (const folder of STORAGE_FOLDER_BLUEPRINTS) {
      const folderName =
        existing?.folders.find((item) => item.folderType === folder.type)?.folderName ??
        folder.defaultName;
      const folderId = null;
      const folderUrl = null;

      await tx.storageFolderSetting.upsert({
        where: {
          integrationId_folderType: {
            integrationId: integration.id,
            folderType: folder.type,
          },
        },
        create: {
          integrationId: integration.id,
          folderType: folder.type,
          folderName,
          folderId,
          folderUrl,
          status: rootStatus,
          lastCheckedAt: null,
        },
        update: {
          folderName,
          folderId,
          folderUrl,
          status: rootStatus,
          lastCheckedAt: null,
        },
      });
    }
  });

  revalidatePath("/users");
  revalidatePath("/users/storage");
  redirect("/users/storage?saved=1");
}

export async function resetStorageSettingsAction() {
  const session = await requireUserSession();
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!currentUser || !canEditUsers(currentUser.role)) {
    throw new Error("No tienes permisos para editar almacenamiento");
  }

  await prisma.$transaction(async (tx) => {
    const integration = await tx.storageIntegrationSetting.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!integration) {
      return;
    }

    await tx.storageFolderSetting.deleteMany({
      where: { integrationId: integration.id },
    });

    await tx.storageIntegrationSetting.update({
      where: { id: integration.id },
      data: {
        status: StorageConnectionStatus.NOT_CONNECTED,
        connectedAccountEmail: null,
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthScope: null,
        oauthTokenExpiresAt: null,
        lastError: null,
        rootFolderName: null,
        rootFolderId: null,
        rootFolderUrl: null,
        notes: null,
        lastValidatedAt: null,
      },
    });
  });

  revalidatePath("/users");
  revalidatePath("/users/storage");
  redirect("/users/storage?reset=1");
}

export async function validateGoogleDriveAction() {
  const session = await requireUserSession();
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!currentUser || !canEditUsers(currentUser.role)) {
    throw new Error("No tienes permisos para validar almacenamiento");
  }

  const integration = await prisma.storageIntegrationSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!integration) {
    throw new Error("Primero debes guardar la configuración de almacenamiento");
  }

  try {
    await validateAndSyncGoogleDriveIntegration(integration.id);
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "No se pudo validar Google Drive";
    redirect(`/users/storage?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/users");
  revalidatePath("/users/storage");
  redirect("/users/storage?validated=1");
}
