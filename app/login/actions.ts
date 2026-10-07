"use server";

import { redirect } from "next/navigation";
import { authClient, getOrganizer } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/login?error=missing");
  const client = await authClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  if (!await getOrganizer()) {
    await client.auth.signOut();
    redirect("/login?error=access");
  }
  redirect("/");
}
