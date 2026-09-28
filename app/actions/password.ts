"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  consumePasswordToken,
  createPasswordToken,
  createSession,
  hashPassword,
  requireUser,
  signOutEverywhere,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { sendPasswordResetEmail } from "@/lib/email";
import { appUrl } from "@/lib/url";
import type { FormState } from "./auth";

const SENT = "If an account exists for that email, we've sent a link to reset your password. Check your inbox (and spam).";

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same answer whether or not the account exists, so the form can't be used to find accounts.
  if (!user) return { ok: SENT };

  const [{ n }] = await db
    .select({ n: count() })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, new Date(Date.now() - 3_600_000))));
  if (n >= 3) return { ok: SENT };

  const token = await createPasswordToken(user.id, 1);
  try {
    await sendPasswordResetEmail(user.email, user.name, `${await appUrl()}/reset-password?token=${token}`);
  } catch (err) {
    console.error("Password reset email failed", err);
    return { error: "We couldn't send the email right now. Please try again in a few minutes." };
  }
  return { ok: SENT };
}

const NewPassword = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match", path: ["confirm"] });

export async function resetPassword(token: string, _: FormState, form: FormData): Promise<FormState> {
  const parsed = NewPassword.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await consumePasswordToken(token, parsed.data.password);
  if (!user) return { error: "This link has expired or was already used. Request a new one." };
  await createSession(user.id);
  redirect("/app");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const parsed = NewPassword.safeParse(Object.fromEntries(form));
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password is incorrect" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, user.id));
  await signOutEverywhere(user.id);
  await createSession(user.id);
  return { ok: "Password updated. Other devices have been signed out." };
}
