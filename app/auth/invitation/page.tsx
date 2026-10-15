import InvitationAcceptance from "@/components/onboarding/invitation-acceptance";
import AuthFeedback from "@/components/auth/auth-feedback";

export default async function InvitationPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-xl space-y-5 bg-slate-50 p-6">
      {status === "invalid" ? (
        <AuthFeedback message="The confirmation link could not be verified. Request a new confirmation or reopen your private invitation and sign in." error />
      ) : null}
      <InvitationAcceptance />
    </main>
  );
}
