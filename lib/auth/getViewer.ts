import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  userId: string;
  email: string;
  displayName: string;
  role: "student" | "admin";
  isBlocked: boolean;
  blockedReason: string | null;
  aal: "aal1" | "aal2";
}

/**
 * De ene bron van waarheid voor "wie is dit en wat mag die". Leest het profiel altijd vers uit
 * de database (nooit uit user_metadata of iets dat de client meestuurt), en het MFA-niveau via
 * de Supabase Auth-sessie zelf.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, role, is_blocked, blocked_reason")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return {
    userId: user.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    isBlocked: profile.is_blocked,
    blockedReason: profile.blocked_reason,
    aal: aalData?.currentLevel === "aal2" ? "aal2" : "aal1",
  };
}

/**
 * Verdediging in de diepte: elke admin-pagina/layout roept dit zelf aan, naast de middleware.
 * Geeft een 404 voor niet-admins (een 403 zou verraden dat de route bestaat). Controleert hier
 * bewust niet op aal2 — dat doet de middleware (zie lib/supabase/middleware.ts), die ook de
 * /admin/mfa-pagina zelf moet kunnen uitzonderen zonder in een omleidingslus te komen.
 */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") {
    notFound();
  }
  return viewer;
}
