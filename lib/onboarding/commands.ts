import "server-only";

import { revalidatePath } from "next/cache";
import { getClinicContext } from "@/lib/auth/context";
import { can, type Permission } from "@/lib/auth/permissions";

export async function administrationContext(permission: Permission) {
  const context = await getClinicContext();
  if (!can(context.profile.role, permission)) throw new Error("Administration permission required");
  return context;
}

type ClinicClient = Awaited<ReturnType<typeof getClinicContext>>["supabase"];

export async function runAdministrationCommand(client: ClinicClient, name: string, parameters: Record<string, unknown>) {
  try {
    const result = await client.rpc(name, parameters);
    return result.error ? null : result;
  } catch {
    return null;
  }
}

export function refreshAdministration() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/clinics");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/audit");
}
