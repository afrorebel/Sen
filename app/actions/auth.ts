"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizations, users } from "@/lib/db/schema";

export interface FormState {
  error?: string;
  ok?: string;
}

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  company: z.string().trim().min(1, "Enter your company name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, company, email, password } = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "An account with this email already exists. Log in instead." };

  const passwordHash = await hashPassword(password);
  const { userId, orgId } = await db.transaction(async (tx) => {
    // The first account on a fresh install becomes staff so the owner can reach /admin.
    const [{ n }] = await tx.select({ n: count() }).from(users);
    const [user] = await tx
      .insert(users)
      .values({ name, email, passwordHash, isStaff: n === 0 || email === process.env.ADMIN_EMAIL?.toLowerCase() })
      .returning({ id: users.id });
    const [org] = await tx.insert(organizations).values({ name: company }).returning({ id: organizations.id });
    await tx.insert(memberships).values({ userId: user.id, orgId: org.id, role: "owner" });
    return { userId: user.id, orgId: org.id };
  });
  await createSession(userId);
  redirect(`/app/o/${orgId}/brands/new`);
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect" };
  }
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/app") || next.startsWith("/admin") ? next : "/app");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
