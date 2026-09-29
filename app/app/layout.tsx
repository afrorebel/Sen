import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="app-shell">{children}</div>;
}
