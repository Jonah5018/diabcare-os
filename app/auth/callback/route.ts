import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && code.length <= 2048) {
    const client = await createClient();
    await client.auth.exchangeCodeForSession(code);
  }
  // A fixed destination avoids accepting an attacker-supplied external redirect.
  const response = NextResponse.redirect(new URL("/auth/invitation", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
