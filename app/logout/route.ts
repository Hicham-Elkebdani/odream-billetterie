import { NextResponse } from "next/server";
import { authClient } from "@/lib/auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Requête non autorisée.", { status: 403 });
  const client = await authClient();
  await client.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
