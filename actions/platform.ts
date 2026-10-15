"use server";

import { revalidatePath } from "next/cache";
import { getPlatformContext } from "@/lib/platform/context";
import { can } from "@/lib/auth/permissions";
import { billingBindingSchema, clinicStatusSchema } from "@/lib/validations/platform";
import type { AdministrationResult } from "@/types/onboarding";

function refreshPlatform() {
  revalidatePath("/platform", "layout");
  revalidatePath("/dashboard", "layout");
}

export async function setClinicStatus(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await getPlatformContext();
  if (!can(profile.role, "platform:manage")) return { error: "Platform management permission required" };
  const parsed = clinicStatusSchema.safeParse({
    clinic_id: form.get("clinic_id"), status: form.get("status"),
    expected: form.get("expected"), reason: form.get("reason"),
  });
  if (!parsed.success) return { error: "Choose a valid clinic status and reason" };
  try {
    const { error } = await supabase.rpc("set_clinic_operational_status", {
      p_clinic: parsed.data.clinic_id, p_status: parsed.data.status,
      p_expected: parsed.data.expected, p_reason: parsed.data.reason,
    });
    if (error) throw new Error("Status change rejected");
  } catch {
    return { error: "Status could not be changed. Refresh the clinic before retrying." };
  }
  refreshPlatform();
  return { success: "Clinic operational status updated and audited." };
}

export async function bindClinicBilling(form: FormData): Promise<AdministrationResult> {
  const { supabase, profile } = await getPlatformContext();
  if (!can(profile.role, "platform:manage")) return { error: "Platform management permission required" };
  const parsed = billingBindingSchema.safeParse({ clinic_id: form.get("clinic_id"), customer: form.get("customer"), subscription: form.get("subscription") });
  if (!parsed.success) return { error: "Enter existing, valid provider account identifiers" };
  try {
    const { error } = await supabase.rpc("bind_billing_account", {
      p_provider: "stripe", p_clinic: parsed.data.clinic_id,
      p_customer: parsed.data.customer, p_subscription: parsed.data.subscription,
    });
    if (error) throw new Error("Billing binding rejected");
  } catch {
    return { error: "Binding could not be saved. Existing account bindings cannot be reassigned here." };
  }
  refreshPlatform();
  return { success: "Provider identifiers bound. No subscription or payment status has been granted." };
}
