const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The current clinic project is never an eligible load target.
const protectedProjects = new Set(["umjstkpzszfzoiqesxob"]);

export function assertLoadTarget(fixture, environment, writes) {
  if (environment.DIABCARE_LOAD_APPROVAL !== "isolated-synthetic-only" || fixture.syntheticOnly !== true) {
    throw new Error("Explicit isolated synthetic environment approval is required.");
  }
  if (!/^[a-z]{20}$/.test(fixture.projectRef) || protectedProjects.has(fixture.projectRef)) {
    throw new Error("The current/protected project cannot be a load target.");
  }
  if (![fixture.organizationId, fixture.patientId, fixture.consultationId].every(value => uuid.test(value ?? ""))) {
    throw new Error("A reviewed synthetic fixture manifest with valid identifiers is required.");
  }
  if (!/^diabcare-load-[a-z0-9-]+$/.test(fixture.expectedSlug ?? "")) throw new Error("Synthetic clinic slug is required.");
  if (writes && environment.DIABCARE_LOAD_WRITES !== "allow-synthetic-writes") throw new Error("Synthetic write approval is required.");

  const key = environment.DIABCARE_LOAD_PUBLIC_KEY ?? "";
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey) {
    try {
      publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon";
    } catch {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error("Use a public publishable/anon key, never a backend key.");

  return `https://${fixture.projectRef}.supabase.co`;
}

export async function verifySyntheticMembership(client, token, fixture, role) {
  const { data: identity, error: authError } = await client.auth.getUser(token);
  if (authError || !identity.user || identity.user.is_anonymous) throw new Error("Verified staging staff identity is required.");
  const { data: staff, error: staffError } = await client.from("users")
    .select("id,organization_id,role,is_active").eq("id", identity.user.id).single();
  if (staffError || !staff?.is_active || staff.role !== role || staff.organization_id !== fixture.organizationId) {
    throw new Error("Staging role or clinic membership mismatch.");
  }
  const { data: clinic, error: clinicError } = await client.from("organizations")
    .select("id,slug").eq("id", staff.organization_id).single();
  const { data: patient, error: patientError } = await client.from("patients")
    .select("id,first_name").eq("id", fixture.patientId).eq("organization_id", staff.organization_id).single();
  const { data: consultation, error: consultationError } = await client.from("consultations")
    .select("id").eq("id", fixture.consultationId).eq("patient_id", fixture.patientId).eq("organization_id", staff.organization_id).single();
  if (clinicError || clinic?.slug !== fixture.expectedSlug || patientError || patient?.first_name !== "Synthetic" || consultationError || !consultation) {
    throw new Error("Reviewed synthetic clinic/patient/consultation prerequisites are missing.");
  }
  return staff.id;
}
