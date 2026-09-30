"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brands } from "@/lib/db/schema";
import { ingestLogs, newTrafficToken, parseLogs } from "@/lib/traffic";
import type { FormState } from "./auth";

const MAX_UPLOAD = 20 * 1024 * 1024;

async function editableBrand(brandId: string) {
  const user = await requireUser();
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  if (!brand) throw new Error("Brand not found");
  const access = await requireOrg(user, brand.orgId);
  if (!access.canEdit) throw new Error("You have view-only access to this workspace");
  return brand;
}

/** Creates the snippet key and the secret drain key, or replaces both (old snippets and drains stop counting). */
export async function rotateTrafficToken(brandId: string) {
  const brand = await editableBrand(brandId);
  await db.update(brands).set({ trafficToken: newTrafficToken(), trafficDrainToken: newTrafficToken() }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

/** Adds a drain key without touching the snippet key already installed on the client's site. */
export async function enableLogDrain(brandId: string) {
  const brand = await editableBrand(brandId);
  if (brand.trafficDrainToken) return;
  await db.update(brands).set({ trafficDrainToken: newTrafficToken() }).where(eq(brands.id, brandId));
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
}

export async function uploadLogs(brandId: string, _: FormState, form: FormData): Promise<FormState> {
  const brand = await editableBrand(brandId);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a log file to upload" };
  if (file.size > MAX_UPLOAD) return { error: "That file is over 20 MB. Split it or use the log drain instead." };
  const events = parseLogs(await file.text());
  if (!events.length) return { error: "We couldn't read any requests. Upload an access log (Combined Log Format) or JSON lines." };
  const { counted, scanned } = await ingestLogs(brandId, events);
  revalidatePath(`/app/o/${brand.orgId}/b/${brandId}`);
  return { ok: `Scanned ${scanned.toLocaleString()} requests and found ${counted.toLocaleString()} from AI crawlers.` };
}
