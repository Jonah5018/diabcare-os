import "server-only";

import type { getClinicContext } from "@/lib/auth/context";
import type { NotificationProvider } from "@/types/notification";

type DatabaseClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];

export function notificationProvider(client: DatabaseClient, name: string): NotificationProvider {
  if (name !== "in_app") throw new Error("Notification provider is not configured");

  return {
    name: "in_app",
    async deliver(job) {
      const { data, error } = await client.rpc("deliver_in_app_notification", {
        p_event: job.id,
        p_token: job.lease_token,
      });
      if (error || !["delivered", "suppressed"].includes(data)) throw new Error("Inbox delivery not confirmed");
      return data as "delivered" | "suppressed";
    },
  };
}
