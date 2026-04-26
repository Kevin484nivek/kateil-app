import { StorageConnectionStatus, StorageFolderType, StorageProvider } from "@prisma/client";

export const STORAGE_PROVIDER_OPTIONS: Array<{ value: StorageProvider; label: string }> = [
  { value: StorageProvider.GOOGLE_DRIVE, label: "Google Drive" },
];

export const STORAGE_FOLDER_BLUEPRINTS: Array<{
  type: StorageFolderType;
  label: string;
  defaultName: string;
  description: string;
}> = [
  {
    type: StorageFolderType.BACKUPS,
    label: "Backups",
    defaultName: "Backups",
    description: "Copias de seguridad completas de PostgreSQL y exportaciones de continuidad.",
  },
  {
    type: StorageFolderType.INVENTORY_ATTACHMENTS,
    label: "Adjuntos mercancía",
    defaultName: "Adjuntos Mercancía",
    description: "Albaranes, facturas y documentos adjuntos de entradas y pedidos de mercancía.",
  },
  {
    type: StorageFolderType.SUPPLIER_ATTACHMENTS,
    label: "Adjuntos proveedores",
    defaultName: "Adjuntos Proveedores",
    description: "Contratos, PDFs y documentos generales asociados a proveedores.",
  },
];

export function getStorageProviderLabel(provider: StorageProvider) {
  return STORAGE_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function getStorageStatusLabel(status: StorageConnectionStatus) {
  switch (status) {
    case StorageConnectionStatus.CONNECTED:
      return "Conectado";
    case StorageConnectionStatus.PENDING:
      return "Pendiente";
    case StorageConnectionStatus.ERROR:
      return "Con incidencia";
    default:
      return "Sin conectar";
  }
}

export function getStorageFolderLabel(type: StorageFolderType) {
  return STORAGE_FOLDER_BLUEPRINTS.find((folder) => folder.type === type)?.label ?? type;
}
