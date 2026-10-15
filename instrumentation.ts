import type { Instrumentation } from "next";
import { emitOperationalEvent, newRequestId } from "@/lib/observability/events";

export const onRequestError: Instrumentation.onRequestError = (_error, request, context) => {
  // Framework errors can contain clinical input or credential-bearing URLs.
  // Capture a fixed event without serializing the error/request/context.
  const path = request.path.split("?")[0];
  const protectedInterface = path === "/dashboard" || path.startsWith("/dashboard/")
    || path === "/platform" || path.startsWith("/platform/");
  const candidate = request.headers["x-request-id"];
  const forwardedId = context.routeType !== "proxy" && protectedInterface && typeof candidate === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate) ? candidate : null;
  emitOperationalEvent({ event: "unhandled_request", request_id: forwardedId ?? newRequestId(), outcome: "failed" });
};
