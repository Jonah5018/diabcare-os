import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

export async function proxy(request: NextRequest) {
  const requestId = newRequestId();
  const nextResponse = () => {
    const forwarded = new Headers(request.headers);
    forwarded.set("x-request-id", requestId);
    return NextResponse.next({ request: { headers: forwarded } });
  };
  let response = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (
    (error || !user) &&
    (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/platform"))
  ) {
    const redirectResponse = NextResponse.redirect(
      new URL("/auth/login", request.url)
    );

    response.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie)
    );
    redirectResponse.headers.set("X-Request-ID", requestId);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    emitOperationalEvent({ event: "auth_check", request_id: requestId, outcome: "rejected" });
    return redirectResponse;
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/platform/:path*"],
};
