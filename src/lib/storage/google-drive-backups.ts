import { StorageConnectionStatus, StorageFolderType } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import {
  refreshGoogleDriveAccessToken,
  uploadGoogleDriveFile,
} from "@/lib/storage/google-drive";

function getBackupMimeType(filePath: string) {
  if (filePath.endsWith(".sql")) {
    return "application/sql";
  }

  if (filePath.endsWith(".json")) {
    return "application/json";
  }

  if (filePath.endsWith(".sha256")) {
    return "text/plain";
  }

  return "application/octet-stream";
}

function getBaseNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.(dump|sql|json|sha256)$/i, "");
}

export async function uploadBackupFilesToGoogleDrive({
  backupFilePath,
  metadataFilePath,
  checksumFilePath,
}: {
  backupFilePath: string;
  metadataFilePath?: string | null;
  checksumFilePath?: string | null;
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
    throw new Error("Falta refresh token de Google Drive");
  }

  const backupFolder = integration.folders.find(
    (folder) => folder.folderType === StorageFolderType.BACKUPS,
  );

  if (!backupFolder?.folderId) {
    throw new Error("No hay carpeta de backups validada en Google Drive");
  }

  const refreshedToken = await refreshGoogleDriveAccessToken(integration.oauthRefreshToken);
  const backupBytes = await readFile(backupFilePath);
  const uploadedFiles = [];

  uploadedFiles.push(
    await uploadGoogleDriveFile({
      accessToken: refreshedToken.access_token,
      fileBytes: backupBytes,
      fileName: path.basename(backupFilePath),
      contentType: getBackupMimeType(backupFilePath),
      parentFolderId: backupFolder.folderId,
    }),
  );

  if (metadataFilePath) {
    const metadataBytes = await readFile(metadataFilePath);
    uploadedFiles.push(
      await uploadGoogleDriveFile({
        accessToken: refreshedToken.access_token,
        fileBytes: metadataBytes,
        fileName: path.basename(metadataFilePath),
        contentType: getBackupMimeType(metadataFilePath),
        parentFolderId: backupFolder.folderId,
      }),
    );
  }

  if (checksumFilePath) {
    const checksumBytes = await readFile(checksumFilePath);
    uploadedFiles.push(
      await uploadGoogleDriveFile({
        accessToken: refreshedToken.access_token,
        fileBytes: checksumBytes,
        fileName: path.basename(checksumFilePath),
        contentType: getBackupMimeType(checksumFilePath),
        parentFolderId: backupFolder.folderId,
      }),
    );
  }

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
        folderType: StorageFolderType.BACKUPS,
      },
    },
    data: {
      status: StorageConnectionStatus.CONNECTED,
      lastCheckedAt: new Date(),
    },
  });

  return {
    baseName: getBaseNameWithoutExtension(path.basename(backupFilePath)),
    uploadedFiles,
  };
}
