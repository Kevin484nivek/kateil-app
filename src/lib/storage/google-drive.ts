const GOOGLE_DRIVE_FOLDER_URL_PATTERN = /\/folders\/([a-zA-Z0-9_-]+)/;
const GOOGLE_DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_API_BASE_URL = "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export const GOOGLE_DRIVE_COOKIE_STATE = "kateil_gdrive_oauth_state";
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export type GoogleDriveTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  parents?: string[];
};

export function extractGoogleDriveFolderId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const matched = normalized.match(GOOGLE_DRIVE_FOLDER_URL_PATTERN);

  if (matched?.[1]) {
    return matched[1];
  }

  return normalized;
}

export function getGoogleDriveOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI ?? "",
  };
}

export function hasGoogleDriveOAuthConfig() {
  const config = getGoogleDriveOAuthConfig();

  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function buildGoogleDriveOAuthUrl(state: string) {
  const config = getGoogleDriveOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_DRIVE_SCOPES,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleDriveCode(code: string) {
  const config = getGoogleDriveOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo intercambiar el código OAuth con Google");
  }

  return (await response.json()) as GoogleDriveTokenPayload;
}

export async function refreshGoogleDriveAccessToken(refreshToken: string) {
  const config = getGoogleDriveOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo refrescar el token de Google Drive");
  }

  return (await response.json()) as GoogleDriveTokenPayload;
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo recuperar la cuenta de Google autorizada");
  }

  const payload = (await response.json()) as {
    email?: string;
  };

  return payload.email ?? null;
}

async function googleDriveApiFetch<T>(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${GOOGLE_DRIVE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive API error (${response.status})`);
  }

  return (await response.json()) as T;
}

export function buildGoogleDriveFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function getGoogleDriveFolder(accessToken: string, folderId: string) {
  return googleDriveApiFetch<GoogleDriveFile>(
    accessToken,
    `/files/${folderId}?fields=id,name,mimeType,webViewLink,parents&supportsAllDrives=true`,
  );
}

export async function findGoogleDriveChildFolder(accessToken: string, parentFolderId: string, folderName: string) {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = [
    `'${parentFolderId}' in parents`,
    `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
    "trashed = false",
    `name = '${escapedName}'`,
  ].join(" and ");

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,webViewLink,parents)",
    spaces: "drive",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "1",
  });

  const payload = await googleDriveApiFetch<{ files?: GoogleDriveFile[] }>(accessToken, `/files?${params.toString()}`);

  return payload.files?.[0] ?? null;
}

export async function createGoogleDriveFolder(accessToken: string, folderName: string, parentFolderId?: string | null) {
  return googleDriveApiFetch<GoogleDriveFile>(accessToken, "/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    }),
  });
}

export async function ensureGoogleDriveChildFolder(accessToken: string, parentFolderId: string, folderName: string) {
  const existing = await findGoogleDriveChildFolder(accessToken, parentFolderId, folderName);

  if (existing) {
    return existing;
  }

  return createGoogleDriveFolder(accessToken, folderName, parentFolderId);
}

export async function uploadGoogleDriveFile({
  accessToken,
  contentType,
  fileBytes,
  fileName,
  parentFolderId,
}: {
  accessToken: string;
  contentType: string;
  fileBytes: Uint8Array;
  fileName: string;
  parentFolderId: string;
}) {
  const boundary = `kateil-${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentFolderId],
  });

  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const footer = encoder.encode(`\r\n--${boundary}--`);

  const payload = new Uint8Array(header.length + fileBytes.length + footer.length);
  payload.set(header, 0);
  payload.set(fileBytes, header.length);
  payload.set(footer, header.length + fileBytes.length);

  const response = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_API_BASE_URL}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    },
  );

  if (!response.ok) {
    throw new Error(`No se pudo subir el archivo a Google Drive (${response.status})`);
  }

  return (await response.json()) as Pick<GoogleDriveFile, "id" | "name" | "webViewLink">;
}
