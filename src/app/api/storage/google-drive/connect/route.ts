import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/session";
import { canEditUsers } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import {
  buildGoogleDriveOAuthUrl,
  GOOGLE_DRIVE_COOKIE_STATE,
  hasGoogleDriveOAuthConfig,
} from "@/lib/storage/google-drive";

export async function GET() {
  const session = await getUserSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
  }

  if (!hasGoogleDriveOAuthConfig()) {
    return NextResponse.redirect(
      new URL("/users/storage?error=oauth-not-configured", process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (!currentUser) {
    return NextResponse.redirect(new URL("/users/storage?error=user-not-found", process.env.APP_URL ?? "http://localhost:3000"));
  }

  if (!canEditUsers(currentUser.role)) {
    return NextResponse.redirect(
      new URL("/users/storage?error=forbidden", process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  const state = randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(GOOGLE_DRIVE_COOKIE_STATE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });

  return NextResponse.redirect(buildGoogleDriveOAuthUrl(state));
}
