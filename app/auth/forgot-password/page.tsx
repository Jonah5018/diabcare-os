import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Let’s get you back."
      description="Enter your account email and we’ll help you reset your password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
