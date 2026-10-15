import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="YOUR CLINIC WORKSPACE"
      title="Welcome back."
      description="Sign in to continue caring, with everything in one place."
    >
      <LoginForm />
    </AuthShell>
  );
}
