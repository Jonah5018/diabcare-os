import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signOut } from "@/actions/auth";
import AuthShell from "@/components/auth/auth-shell";
import { authButtonClass, authLinkClass } from "@/components/auth/form-styles";

export const metadata: Metadata = { title: "Clinic access unavailable" };

export default function AccessPage() {
  return (
    <AuthShell
      eyebrow="WORKSPACE ACCESS"
      title="Let’s connect your clinic."
      description="Your account needs an active clinic profile before you can open the workspace."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <LockKeyhole size={23} strokeWidth={1.5} className="mb-4 text-sky-800" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">Clinic access unavailable</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Contact your clinic administrator to restore access or assign your clinic. If you’ve received a private invitation, you can accept it below.
          </p>
          <Link href="/auth/invitation" className={`${authLinkClass} mt-3`}>
            Accept a private clinic invitation <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <form action={signOut}>
          <button type="submit" className={authButtonClass}>Sign out</button>
        </form>
      </div>
    </AuthShell>
  );
}
