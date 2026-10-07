import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Organizer = { userId: string; email: string; displayName: string };

export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured.");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* A Server Component cannot write cookies; route handlers can. */ }
      },
    },
  });
}

const initialOrganizer = "hichamelkebdani123@gmail.com";

export async function getOrganizer(): Promise<Organizer | null> {
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email) return null;
  const email = user.email.toLowerCase();
  const allowed = (process.env.ORGANIZER_EMAILS || initialOrganizer)
    .split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email)) return null;
  return { userId: user.id, email, displayName: user.user_metadata?.full_name || email };
}

export async function requireOrganizer(): Promise<Organizer> {
  const organizer = await getOrganizer();
  if (!organizer) redirect("/login");
  return organizer;
}
