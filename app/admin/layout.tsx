import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="app-shell">{children}</div>;
}
