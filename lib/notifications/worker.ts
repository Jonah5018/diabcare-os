import "server-only";

import { z } from "zod";
import { notificationProvider } from "@/lib/notifications/providers";
import type { getClinicContext } from "@/lib/auth/context";
import type { NotificationJob } from "@/types/notification";

type DatabaseClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];
const jobSchema = z.object({
  id: z.uuid(),
  lease_token: z.uuid(),
  provider: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
}).passthrough();

export async function runNotificationBatch(client: DatabaseClient) {
  const { data, error } = await client.rpc("claim_notification_jobs", { p_limit: 10 });
  if (error) throw new Error("Notification jobs could not be claimed");
  const jobs = z.array(jobSchema).max(10).parse(data ?? []);
  const result = { claimed: jobs.length, delivered: 0, suppressed: 0, uncertain: 0 };

  for (const item of jobs) {
    const job = item as unknown as NotificationJob;
    try {
      const outcome = await notificationProvider(client, job.provider).deliver(job);
      if (outcome === "delivered") result.delivered += 1;
      else if (outcome === "suppressed") result.suppressed += 1;
    } catch {
      // A timeout may follow an already committed delivery. Do not claim failure
      // or success; the guarded command/reclaim path resolves database state.
      result.uncertain += 1;
      await Promise.resolve(client.rpc("fail_notification_attempt", {
        p_event: job.id,
        p_token: job.lease_token,
      })).catch(() => null);
    }
  }
  return result;
}
