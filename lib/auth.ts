import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import {
  memberships,
  organizations,
  passwordResets,
  sessions,
  users,
  type MemberRole,
  type Organization,
  type User,
} from "./db/schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "aeo_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: tokenId(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
  jar.delete(COOKIE);
}

/** The signed-in user, or null. Cached per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!user.isStaff) redirect("/app");
  return user;
}

export interface OrgAccess {
  org: Organization;
  /** Staff act with owner-level rights on every organization. */
  role: MemberRole;
  canEdit: boolean;
}

export const getOrgs = cache(async (userId: string) =>
  db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.createdAt),
);

/** Loads an organization the user may see, or redirects away. */
export async function requireOrg(user: User, orgId: string): Promise<OrgAccess> {
  if (user.isStaff) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) redirect("/app");
    return { org, role: "owner", canEdit: true };
  }
  const match = (await getOrgs(user.id)).find((m) => m.org.id === orgId);
  if (!match) redirect("/app");
  return { org: match.org, role: match.role, canEdit: match.role !== "client" };
}

// ---------------------------------------------------------------------------
// Password reset & invite links
// ---------------------------------------------------------------------------

/** Creates a single-use link token. Only its hash is stored. */
export async function createPasswordToken(userId: string, hours: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    id: tokenId(token),
    userId,
    expiresAt: new Date(Date.now() + hours * 3_600_000),
  });
  return token;
}

/** Returns the user for a valid, unused, unexpired token. */
export async function findPasswordToken(token: string) {
  const rows = await db
    .select({ reset: passwordResets, user: users })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(eq(passwordResets.id, tokenId(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Sets a new password, burns the token and signs out every other session. */
export async function consumePasswordToken(token: string, newPassword: string): Promise<User | null> {
  const found = await findPasswordToken(token);
  if (!found) return null;
  const passwordHash = await hashPassword(newPassword);
  const ok = await db.transaction(async (tx) => {
    // Claim the token atomically so two simultaneous submits can't both use it.
    const claimed = await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.id, tokenId(token)), isNull(passwordResets.usedAt)))
      .returning({ id: passwordResets.id });
    if (!claimed.length) return false;
    // Any other outstanding links for this user stop working too.
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, found.user.id), isNull(passwordResets.usedAt)));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, found.user.id));
    await tx.delete(sessions).where(eq(sessions.userId, found.user.id));
    return true;
  });
  return ok ? found.user : null;
}

export async function signOutEverywhere(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
