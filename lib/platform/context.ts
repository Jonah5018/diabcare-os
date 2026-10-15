import "server-only";

import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";

export async function getPlatformContext() {
  const context = await getStaffContext();
  if (!can(context.profile.role, "platform:view")) redirect("/dashboard");
  return context;
}
