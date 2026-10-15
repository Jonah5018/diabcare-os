import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  let canReset = false;

  if (status !== "invalid") {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.getUser();
      canReset = !error && Boolean(data.user && !data.user.is_anonymous);
    } catch {
      canReset = false;
    }
  }

  return (
    <AuthShell
      eyebrow="A FRESH START"
      title="Set a new password."
      description="Choose a strong password to keep your clinic workspace protected."
    >
      <ResetPasswordForm canReset={canReset} />
    </AuthShell>
  );
}
