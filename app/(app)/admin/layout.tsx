import { requireAdmin } from "@/lib/auth/getViewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Verdediging in de diepte: naast de middleware controleert ook deze layout zelf of de
  // gebruiker admin is (404, geen redirect). De database (is_admin_mfa()) controleert bij elke
  // beheerfunctie nog een derde keer.
  await requireAdmin();
  return <>{children}</>;
}
