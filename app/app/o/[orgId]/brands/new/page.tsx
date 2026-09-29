import { redirect } from "next/navigation";
import { createBrand } from "@/app/actions/brands";
import { requireOrg, requireUser } from "@/lib/auth";
import { planFor } from "@/lib/plans";
import { BrandForm } from "./brand-form";

export const metadata = { title: "Add brand · AEO GrowthLead" };

export default async function NewBrand({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const user = await requireUser();
  const { org, canEdit } = await requireOrg(user, orgId);
  if (!canEdit) redirect(`/app/o/${orgId}`);
  const plan = planFor(org.plan);
  return (
    <div className="stack-lg narrow">
      <div>
        <h1>Add a brand</h1>
        <p className="muted">
          We&apos;ll ask AI engines the questions your buyers ask and show whether they name you, rank you and cite your site.
          Your {plan.name} plan includes {plan.prompts} prompts.
        </p>
      </div>
      <BrandForm action={createBrand.bind(null, orgId)} promptLimit={plan.prompts} />
    </div>
  );
}
