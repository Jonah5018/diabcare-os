import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const recovery = request.nextUrl.searchParams.get("next") === "/auth/reset-password";
  const destination = recovery ? "/auth/reset-password" : "/auth/invitation";
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  let exchanged = false;

  if (
    code && code.length <= 2048 &&
    request.nextUrl.searchParams.getAll("code").length === 1 &&
    !request.nextUrl.searchParams.has("error") &&
    (flowId === null || /^[a-zA-Z0-9_-]{8,64}$/.test(flowId))
  ) {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      exchanged = !error && Boolean(data?.session);
    } catch {
      exchanged = false;
    }
  }

  // Only these two literal destinations are permitted; no submitted URL is resolved.
  const target = new URL(destination, request.url);
  if (!exchanged) target.searchParams.set("status", "invalid");

  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
