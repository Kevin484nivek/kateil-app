import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/session";
import { canEditUsers } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import {
  exchangeGoogleDriveCode,
  fetchGoogleAccountEmail,
  GOOGLE_DRIVE_COOKIE_STATE,
} from "@/lib/storage/google-drive";
import { validateAndSyncGoogleDriveIntegration } from "@/lib/storage/google-drive-integration";
import { StorageConnectionStatus, StorageProvider } from "@prisma/client";

function getBaseUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const session = await getUserSession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_DRIVE_COOKIE_STATE)?.value ?? null;

  cookieStore.delete(GOOGLE_DRIVE_COOKIE_STATE);

  if (!session) {
    return NextResponse.redirect(new URL("/login", getBaseUrl()));
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!currentUser || !canEditUsers(currentUser.role)) {
    return NextResponse.redirect(new URL("/users/storage?error=forbidden", getBaseUrl()));
  }

  if (error) {
    return NextResponse.redirect(
      new URL(`/users/storage?error=${encodeURIComponent(error)}`, getBaseUrl()),
    );
  }

  if (!code || !state || !storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/users/storage?error=invalid-oauth-state", getBaseUrl()));
  }

  try {
    const tokenPayload = await exchangeGoogleDriveCode(code);
    const accountEmail = await fetchGoogleAccountEmail(tokenPayload.access_token);
    const existing = await prisma.storageIntegrationSetting.findFirst({
      orderBy: { createdAt: "asc" },
    });

    const data = {
      provider: StorageProvider.GOOGLE_DRIVE,
      status: StorageConnectionStatus.PENDING,
      connectedAccountEmail: accountEmail,
      oauthAccessToken: tokenPayload.access_token,
      oauthRefreshToken: tokenPayload.refresh_token ?? existing?.oauthRefreshToken ?? null,
      oauthScope: tokenPayload.scope ?? null,
      oauthTokenExpiresAt: tokenPayload.expires_in
        ? new Date(Date.now() + tokenPayload.expires_in * 1000)
        : null,
      lastError: null,
    };

    let integrationId = existing?.id ?? null;

    if (existing) {
      await prisma.storageIntegrationSetting.update({
        where: { id: existing.id },
        data,
      });
      integrationId = existing.id;
    } else {
      const created = await prisma.storageIntegrationSetting.create({
        data,
      });
      integrationId = created.id;
    }

    if (integrationId) {
      await validateAndSyncGoogleDriveIntegration(integrationId);
    }

    return NextResponse.redirect(
      new URL("/users/storage?connected=google-drive&validated=1", getBaseUrl()),
    );
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "google-drive-oauth-error";
    const existing = await prisma.storageIntegrationSetting.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      await prisma.storageIntegrationSetting.update({
        where: { id: existing.id },
        data: {
          status: StorageConnectionStatus.ERROR,
          lastError: message,
        },
      });
    }

    return NextResponse.redirect(
      new URL(`/users/storage?error=${encodeURIComponent(message)}`, getBaseUrl()),
    );
  }
}
