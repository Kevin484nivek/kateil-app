import { StorageConnectionStatus, StorageFolderType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  refreshGoogleDriveAccessToken,
  uploadGoogleDriveFile,
} from "@/lib/storage/google-drive";

export async function uploadFileToGoogleDriveFolderType({
  contentType,
  fileBytes,
  fileName,
  folderType,
}: {
  contentType: string;
  fileBytes: Uint8Array;
  fileName: string;
  folderType: StorageFolderType;
}) {
  const integration = await prisma.storageIntegrationSetting.findFirst({
    include: {
      folders: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!integration) {
    throw new Error("No existe configuración de almacenamiento");
  }

  if (!integration.oauthRefreshToken) {
    throw new Error("Google Drive no está autenticado");
  }

  const targetFolder = integration.folders.find((folder) => folder.folderType === folderType);

  if (!targetFolder?.folderId) {
    throw new Error("Carpeta de Google Drive no configurada para este tipo de adjunto");
  }

  const refreshedToken = await refreshGoogleDriveAccessToken(integration.oauthRefreshToken);
  const uploaded = await uploadGoogleDriveFile({
    accessToken: refreshedToken.access_token,
    contentType: contentType || "application/octet-stream",
    fileBytes,
    fileName,
    parentFolderId: targetFolder.folderId,
  });

  await prisma.storageIntegrationSetting.update({
    where: { id: integration.id },
    data: {
      status: StorageConnectionStatus.CONNECTED,
      oauthAccessToken: refreshedToken.access_token,
      oauthScope: refreshedToken.scope ?? integration.oauthScope,
      oauthTokenExpiresAt: refreshedToken.expires_in
        ? new Date(Date.now() + refreshedToken.expires_in * 1000)
        : integration.oauthTokenExpiresAt,
      lastValidatedAt: new Date(),
      lastError: null,
    },
  });

  await prisma.storageFolderSetting.update({
    where: {
      integrationId_folderType: {
        integrationId: integration.id,
        folderType,
      },
    },
    data: {
      lastCheckedAt: new Date(),
      status: StorageConnectionStatus.CONNECTED,
    },
  });

  return uploaded.webViewLink ?? null;
}
