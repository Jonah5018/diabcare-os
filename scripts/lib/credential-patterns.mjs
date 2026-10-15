export function credentialPatterns(source) {
  const rules = [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["supabase-server-secret", /sb_secret_[A-Za-z0-9_-]{24,}/],
    ["stripe-live-key", /sk_live_[A-Za-z0-9]{20,}/],
    ["stripe-signing-secret", /whsec_[A-Za-z0-9]{32,}/],
    ["github-token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{36,}/],
    ["aws-access-key", /AKIA[A-Z0-9]{16}/],
  ];
  const matches = rules.filter(([, rule]) => rule.test(source)).map(([name]) => name);

  for (const token of source.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
    try {
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      if (claims.role !== "anon") matches.push("non-public-jwt");
    } catch {
      matches.push("jwt-like-value");
    }
  }

  return [...new Set(matches)];
}
