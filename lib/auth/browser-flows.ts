import type { SupabaseClient } from "@supabase/supabase-js";
import { authEmailSchema, resetPasswordSchema } from "@/lib/validations/auth";

type AuthClient = Pick<SupabaseClient, "auth">;

export const resetRequestMessage = "If an account exists for that email, a password reset link has been sent.";
export const recoveryUnavailableMessage = "This recovery session is unavailable or has expired. Request a new reset link and open it in the same browser.";

export async function signInWithEmail(client: AuthClient, email: string, password: string) {
  const parsed = authEmailSchema.safeParse(email);
  if (!parsed.success || !password.trim()) return { error: "Enter your email address and password." };

  try {
    const { error } = await client.auth.signInWithPassword({ email: parsed.data, password });
    return error
      ? { error: "We couldn't sign you in. Check your email and password, then try again." }
      : { success: true };
  } catch {
    return { error: "Sign in is temporarily unavailable. Please try again." };
  }
}

export async function requestPasswordReset(client: AuthClient, email: string, origin: string) {
  const parsed = authEmailSchema.safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email address." };

  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", "/auth/reset-password");

  try {
    await client.auth.resetPasswordForEmail(parsed.data, { redirectTo: callback.href });
  } catch {
    // The outward result must not vary with account existence or provider detail.
  }

  return { success: resetRequestMessage };
}

export async function endRecoverySession(client: AuthClient) {
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    return !error;
  } catch {
    return false;
  }
}

export async function updateRecoveredPassword(client: AuthClient, password: string, confirmation: string) {
  const parsed = resetPasswordSchema.safeParse({ password, confirmation });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { data, error: sessionError } = await client.auth.getUser();
    if (sessionError || !data.user || data.user.is_anonymous) {
      return { error: recoveryUnavailableMessage, expired: true };
    }

    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) {
      const expired = error.status === 401 || [
        "session_not_found",
        "refresh_token_not_found",
        "refresh_token_already_used",
        "bad_jwt",
        "jwt_expired",
        "reauthentication_needed",
      ].includes(error.code ?? "");
      const message = error.code === "weak_password"
        ? "Choose a stronger password that meets your clinic’s policy. Avoid common or compromised passwords."
        : "We couldn't update your password. Choose a different password or request a new reset link.";

      return {
        error: expired ? recoveryUnavailableMessage : message,
        expired,
      };
    }
  } catch {
    return { error: "The password update could not be confirmed. Try signing in before retrying, or request a new reset link." };
  }

  return { success: true, signedOut: await endRecoverySession(client) };
}
