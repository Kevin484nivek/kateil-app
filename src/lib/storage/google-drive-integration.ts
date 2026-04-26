import { StorageConnectionStatus, StorageFolderType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  buildGoogleDriveFolderUrl,
  createGoogleDriveFolder,
  ensureGoogleDriveChildFolder,
  getGoogleDriveFolder,
  refreshGoogleDriveAccessToken,
} from "@/lib/storage/google-drive";
import { STORAGE_FOLDER_BLUEPRINTS } from "@/lib/storage/settings";

function getFolderNameByType(type: StorageFolderType) {
  return STORAGE_FOLDER_BLUEPRINTS.find((item) => item.type === type)?.defaultName ?? type;
}

export async function validateAndSyncGoogleDriveIntegration(integrationId: string) {
  const integration = await prisma.storageIntegrationSetting.findUnique({
    where: { id: integrationId },
    include: { folders: true },
  });

  if (!integration) {
    throw new Error("No existe configuración de Google Drive");
  }

  if (!integration.oauthRefreshToken) {
    throw new Error("Falta refresh token de Google Drive");
  }

  try {
    const refreshedToken = await refreshGoogleDriveAccessToken(integration.oauthRefreshToken);
    let rootFolderId = integration.rootFolderId;
    let rootFolderName = integration.rootFolderName ?? "Kateil";
    let rootFolderUrl = integration.rootFolderUrl;

    if (rootFolderId) {
      const rootFolder = await getGoogleDriveFolder(refreshedToken.access_token, rootFolderId);
      rootFolderName = rootFolder.name;
      rootFolderUrl = rootFolder.webViewLink ?? buildGoogleDriveFolderUrl(rootFolder.id);
    } else {
      const createdRoot = await createGoogleDriveFolder(refreshedToken.access_token, rootFolderName);
      rootFolderId = createdRoot.id;
      rootFolderName = createdRoot.name;
      rootFolderUrl = createdRoot.webViewLink ?? buildGoogleDriveFolderUrl(createdRoot.id);
    }

    if (!rootFolderId) {
      throw new Error("No se pudo resolver la carpeta raíz de Google Drive");
    }

    const validatedAt = new Date();
    const folderSyncResults: Array<{
      folderType: StorageFolderType;
      folderName: string;
      folderId: string;
      folderUrl: string;
    }> = [];

    for (const blueprint of STORAGE_FOLDER_BLUEPRINTS) {
      const configuredFolder = integration.folders.find((folder) => folder.folderType === blueprint.type);
      const folderName = configuredFolder?.folderName ?? getFolderNameByType(blueprint.type);
      const folder = await ensureGoogleDriveChildFolder(
        refreshedToken.access_token,
        rootFolderId,
        folderName,
      );

      folderSyncResults.push({
        folderType: blueprint.type,
        folderName: folder.name,
        folderId: folder.id,
        folderUrl: folder.webViewLink ?? buildGoogleDriveFolderUrl(folder.id),
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.storageIntegrationSetting.update({
        where: { id: integration.id },
        data: {
          status: StorageConnectionStatus.CONNECTED,
          oauthAccessToken: refreshedToken.access_token,
          oauthScope: refreshedToken.scope ?? integration.oauthScope,
          oauthTokenExpiresAt: refreshedToken.expires_in
            ? new Date(Date.now() + refreshedToken.expires_in * 1000)
            : integration.oauthTokenExpiresAt,
          rootFolderId,
          rootFolderName,
          rootFolderUrl,
          lastValidatedAt: validatedAt,
          lastError: null,
        },
      });

      for (const folder of folderSyncResults) {
        await tx.storageFolderSetting.upsert({
          where: {
            integrationId_folderType: {
              integrationId: integration.id,
              folderType: folder.folderType,
            },
          },
          create: {
            integrationId: integration.id,
            folderType: folder.folderType,
            folderName: folder.folderName,
            folderId: folder.folderId,
            folderUrl: folder.folderUrl,
            status: StorageConnectionStatus.CONNECTED,
            lastCheckedAt: validatedAt,
          },
          update: {
            folderName: folder.folderName,
            folderId: folder.folderId,
            folderUrl: folder.folderUrl,
            status: StorageConnectionStatus.CONNECTED,
            lastCheckedAt: validatedAt,
          },
        });
      }
    });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Error validando Google Drive";

    await prisma.storageIntegrationSetting.update({
      where: { id: integration.id },
      data: {
        status: StorageConnectionStatus.ERROR,
        lastError: message,
      },
    });

    throw new Error(message);
  }
}
