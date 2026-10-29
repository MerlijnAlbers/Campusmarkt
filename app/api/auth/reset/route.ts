import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERIC_ERROR = "E-mailadres of code klopt niet, of de code is verlopen.";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^[0-9]{8}$/),
  password: z.string().min(8),
});

// Eenvoudige in-memory teller per IP: volstaat voor de pilotschaal van deze app. Reset bij elke
// nieuwe server-instantie (bv. een nieuwe Vercel-functie-cold-start) — dat is hier geen probleem.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "onbekend";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Te veel pogingen. Probeer het over een kwartier opnieuw." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: userId, error: consumeError } = await supabase.rpc("consume_reset_code", {
    p_email: parsed.data.email,
    p_code: parsed.data.code,
  });

  if (consumeError || !userId) {
    if (consumeError) {
      // Tijdelijke diagnose-logging (livegang) — verwijdert geen gevoelige gegevens van de
      // gebruiker, alleen de technische Supabase-foutmelding zelf.
      console.error("[reset] consume_reset_code RPC-fout:", consumeError);
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  });
  if (updateError) {
    console.error("[reset] updateUserById-fout:", updateError);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
