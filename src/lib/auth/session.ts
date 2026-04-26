import { createHmac } from "node:crypto";

import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE_NAME = "kateil_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
  activeOrgId: string;
  exp: number;
};

function getSessionSecret() {
  return process.env.AUTH_SECRET ?? "change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);

  return `${body}.${signature}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = sign(body);

  if (expectedSignature !== signature) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;

  if (!payload.activeOrgId) {
    return null;
  }

  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export async function createUserSession(input: Omit<SessionPayload, "exp">) {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    ...input,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };

  cookieStore.set(SESSION_COOKIE_NAME, encode(payload), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const decoded = decode(token);

  if (!decoded) {
    return null;
  }

  let membership = null;

  try {
    membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: decoded.userId,
        organizationId: decoded.activeOrgId,
        isActive: true,
        organization: {
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    console.warn("Falling back to legacy session mode while tenant tables are unavailable.", error);
    return decoded;
  }

  if (!membership) {
    return null;
  }

  return decoded;
}

export async function requireUserSession() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
