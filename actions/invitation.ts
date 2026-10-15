"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/lib/validations/onboarding";
import type { AdministrationResult } from "@/types/onboarding";

export async function acceptInvitation(form: FormData): Promise<AdministrationResult> {
  const token = invitationTokenSchema.safeParse(form.get("token"));
  if (!token.success) return { error: "Invalid invitation secret." };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: "Sign in with the verified invited email first." };
  try {
    const result = await supabase.rpc("accept_staff_invitation", { p_token: token.data });
    if (result.error) return { error: "Invitation unavailable. Check the verified email, expiry, revocation and existing clinic membership with your administrator." };
  } catch {
    return { error: "Acceptance could not be confirmed. Check your clinic access before retrying." };
  }
  revalidatePath("/dashboard", "layout");
  return { success: "Invitation accepted. Open your clinic workspace." };
}
