/* eslint-disable @typescript-eslint/no-require-imports -- Standalone auth verification without additional dependencies. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./source-loader.cjs");

const styles = load("components/auth/form-styles.ts");
const PasswordField = load("components/auth/password-field.tsx", { "./form-styles": styles }).default;
const AuthFeedback = load("components/auth/auth-feedback.tsx").default;
const AuthShell = load("components/auth/auth-shell.tsx", {
  "./auth-shell.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
}).default;

const { authEmailSchema, resetPasswordSchema } = load("lib/validations/auth.ts");
const flows = load("lib/auth/browser-flows.ts");
const password = "Synthetic passphrase 2026!";
const privateError = { message: "PRIVATE_PROVIDER_DETAIL", code: "invalid_credentials" };

assert.equal(authEmailSchema.parse("  test@example.invalid "), "test@example.invalid");
assert.equal(authEmailSchema.safeParse("invalid-email").success, false);
assert.equal(resetPasswordSchema.safeParse({ password: "short", confirmation: "short" }).success, false);
assert.equal(resetPasswordSchema.safeParse({ password: " ".repeat(12), confirmation: " ".repeat(12) }).success, false);
assert.equal(resetPasswordSchema.safeParse({ password, confirmation: "different" }).success, false);
assert.equal(resetPasswordSchema.safeParse({ password, confirmation: password }).success, true);

// Exercise real component handlers with an isolated hook-state harness, not a browser.
function componentHarness(file, mocks = {}, runtime = {}) {
  const state = [];
  let index = 0;
  const hooks = {
    ...React,
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initial === "function" ? initial() : initial;
      return [state[slot], value => { state[slot] = typeof value === "function" ? value(state[slot]) : value; }];
    },
  };
  const Component = load(file, { ...mocks, react: hooks }, runtime).default;
  return { render(props = {}) { index = 0; return Component(props); } };
}

function nodes(element, predicate) {
  if (!element || typeof element !== "object") return [];
  const children = React.Children.toArray(element.props?.children);
  return [
    ...(predicate(element) ? [element] : []),
    ...children.flatMap(child => nodes(child, predicate)),
  ];
}

class FormDataFixture {
  constructor(form) { this.values = form.values; }
  get(name) { return this.values[name] ?? null; }
}

function submitEvent(values) {
  return { preventDefault() {}, currentTarget: { values, reset() {} } };
}

async function verify() {
  let mode = "success";
  const calls = [];
  const client = {
    auth: {
      async signInWithPassword(input) {
        calls.push({ kind: "login", input });
        if (mode === "throw") throw privateError;
        return { error: mode === "error" ? privateError : null };
      },
      async resetPasswordForEmail(email, options) {
        calls.push({ kind: "request", email, options });
        if (mode === "throw") throw privateError;
        return { error: mode === "error" ? privateError : null };
      },
      async getUser() {
        calls.push({ kind: "user" });
        if (mode === "throw") throw privateError;
        return { data: { user: mode === "expired" ? null : { id: "synthetic-user", is_anonymous: mode === "anonymous" } }, error: null };
      },
      async updateUser(input) {
        calls.push({ kind: "update", input });
        return { error: mode === "error" ? privateError : mode === "stale" ? { ...privateError, code: "session_not_found" } : null };
      },
      async signOut(input) {
        calls.push({ kind: "signout", input });
        return { error: mode === "signout-error" ? privateError : null };
      },
    },
  };

  assert.equal((await flows.signInWithEmail(client, "test@example.invalid", password)).success, true);
  mode = "error";
  assert.equal(JSON.stringify(await flows.signInWithEmail(client, "test@example.invalid", password)).includes(privateError.message), false);
  mode = "throw";
  assert.match((await flows.signInWithEmail(client, "test@example.invalid", password)).error, /temporarily unavailable/);

  const requests = [];
  for (mode of ["success", "error", "throw"]) {
    requests.push(await flows.requestPasswordReset(client, "test@example.invalid", "https://clinic.example"));
  }
  assert.equal(new Set(requests.map(result => JSON.stringify(result))).size, 1);
  assert.equal(requests[0].success, flows.resetRequestMessage);
  const callback = new URL(calls.find(call => call.kind === "request").options.redirectTo);
  assert.equal(callback.origin, "https://clinic.example");
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.searchParams.get("next"), "/auth/reset-password");
  const requestCount = calls.length;
  assert.match((await flows.requestPasswordReset(client, "invalid", "https://clinic.example")).error, /valid email/);
  assert.equal(calls.length, requestCount);

  mode = "success";
  const updateCount = calls.length;
  assert.match((await flows.updateRecoveredPassword(client, password, "different")).error, /do not match/);
  assert.equal(calls.length, updateCount);
  for (mode of ["expired", "anonymous"]) {
    const before = calls.filter(call => call.kind === "update").length;
    assert.equal((await flows.updateRecoveredPassword(client, password, password)).expired, true);
    assert.equal(calls.filter(call => call.kind === "update").length, before);
  }
  mode = "error";
  assert.equal(JSON.stringify(await flows.updateRecoveredPassword(client, password, password)).includes(privateError.message), false);
  mode = "stale";
  assert.equal((await flows.updateRecoveredPassword(client, password, password)).expired, true);
  mode = "success";
  const updated = await flows.updateRecoveredPassword(client, password, password);
  assert.equal(updated.success, true);
  assert.equal(updated.signedOut, true);
  assert.equal(calls.at(-1).input.scope, "local");
  assert.equal(calls.at(-2).input.password, password);
  mode = "signout-error";
  const partial = await flows.updateRecoveredPassword(client, password, password);
  assert.equal(partial.success, true);
  assert.equal(partial.signedOut, false);

  let exchangeError = false;
  let exchangeThrows = false;
  const exchanges = [];
  const { GET } = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse: { redirect: url => ({ url: url.href, headers: new Headers() }) } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      async exchangeCodeForSession(code, options) {
        exchanges.push({ code, options });
        if (exchangeThrows) throw privateError;
        return { data: { session: exchangeError ? null : {} }, error: exchangeError ? privateError : null };
      },
    } }) },
  });
  async function visit(query) {
    const url = new URL(`https://clinic.example/auth/callback?${query}`);
    return GET({ nextUrl: url, url: url.href });
  }
  for (const unsafe of ["https://attacker.example", "//attacker.example", "/dashboard", "/auth/reset-password?next=evil", "/\\attacker.example"]) {
    const response = await visit(`code=synthetic&next=${encodeURIComponent(unsafe)}`);
    assert.equal(response.url, "https://clinic.example/auth/invitation");
  }
  const recovery = await visit("code=synthetic&next=/auth/reset-password&sb_flow_id=valid_flow_123");
  assert.equal(recovery.url, "https://clinic.example/auth/reset-password");
  assert.equal(exchanges.at(-1).options.flowId, "valid_flow_123");
  assert.equal(recovery.headers.get("Cache-Control"), "private, no-store");
  assert.equal(recovery.headers.get("Referrer-Policy"), "no-referrer");
  for (const query of ["next=/auth/reset-password", "code=a&code=b&next=/auth/reset-password", "code=a&error=access_denied&next=/auth/reset-password", "code=a&sb_flow_id=bad&next=/auth/reset-password", `code=${"a".repeat(2049)}&next=/auth/reset-password`]) {
    const before = exchanges.length;
    assert.equal((await visit(query)).url, "https://clinic.example/auth/reset-password?status=invalid");
    assert.equal(exchanges.length, before);
  }
  exchangeError = true;
  assert.equal((await visit("code=a&next=/auth/reset-password")).url, "https://clinic.example/auth/reset-password?status=invalid");
  exchangeError = false;
  exchangeThrows = true;
  assert.equal((await visit("code=a&next=/auth/reset-password")).url.includes("status=invalid"), true);
  exchangeThrows = false;

  let cookieOptions;
  const storedCookies = [];
  const { createClient: createServerClient } = load("lib/supabase/server.ts", {
    "next/headers": { cookies: async () => ({ getAll: () => [{ name: "synthetic-cookie", value: "test-only" }], set: (...args) => storedCookies.push(args) }) },
    "@supabase/ssr": { createServerClient: (_, __, options) => { cookieOptions = options.cookies; return {}; } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-placeholder" } } });
  await createServerClient();
  assert.equal(cookieOptions.getAll()[0].name, "synthetic-cookie");
  cookieOptions.setAll([{ name: "synthetic-session", value: "test-only", options: { path: "/", sameSite: "lax" } }]);
  assert.equal(storedCookies[0][0], "synthetic-session");

  const eye = componentHarness("components/auth/password-field.tsx", { "./form-styles": styles });
  let field = eye.render({ id: "test-password", name: "password", label: "Password", autoComplete: "current-password" });
  assert.equal(nodes(field, node => node.type === "input")[0].props.type, "password");
  let toggle = nodes(field, node => node.type === "button")[0];
  assert.equal(toggle.props["aria-label"], "Show password");
  assert.equal(toggle.props.type, "button");
  toggle.props.onClick();
  field = eye.render({ id: "test-password", name: "password", label: "Password", autoComplete: "current-password" });
  assert.equal(nodes(field, node => node.type === "input")[0].props.type, "text");
  toggle = nodes(field, node => node.type === "button")[0];
  assert.equal(toggle.props["aria-label"], "Hide password");
  assert.equal(toggle.props["aria-pressed"], true);

  const links = { "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
  const formMocks = { ...links, "./auth-feedback": AuthFeedback, "./password-field": PasswordField, "./form-styles": styles, "@/lib/supabase/client": { createClient: () => client } };
  const routes = [];
  const LoginForm = load("components/auth/login-form.tsx", { ...formMocks, "next/navigation": { useRouter: () => ({ push: path => routes.push(path), refresh() {} }) } }).default;
  const ForgotForm = load("components/auth/forgot-password-form.tsx", formMocks).default;
  const ResetForm = load("components/auth/reset-password-form.tsx", formMocks).default;
  const loginMarkup = renderToStaticMarkup(React.createElement(LoginForm));
  assert.match(loginMarkup, /autoComplete="username"/);
  assert.match(loginMarkup, /autoComplete="current-password"/);
  assert.match(loginMarkup, /href="\/auth\/forgot-password"/);
  assert.match(loginMarkup, /aria-label="Show password"/);
  assert.match(loginMarkup, /name="password"/);
  assert.match(renderToStaticMarkup(React.createElement(ForgotForm)), /Back to sign in/);
  const resetMarkup = renderToStaticMarkup(React.createElement(ResetForm, { canReset: true }));
  assert.equal((resetMarkup.match(/autoComplete="new-password"/g) ?? []).length, 2);
  assert.match(resetMarkup, /minLength="12"/);
  const expiredMarkup = renderToStaticMarkup(React.createElement(ResetForm, { canReset: false }));
  assert.match(expiredMarkup, /Request a new reset link/);
  assert.equal(expiredMarkup.includes('name="password"'), false);
  const shellMarkup = renderToStaticMarkup(React.createElement(AuthShell, { eyebrow: "Test", title: "Test auth", description: "Synthetic content" }, "Form"));
  assert.match(shellMarkup, /id="main-content"/);
  assert.match(shellMarkup, /Role-aware access/);
  assert.match(shellMarkup, /Multi-tenant isolation/);
  assert.equal(/HIPAA|GDPR|ISO certified|end-to-end/i.test(shellMarkup), false);

  const login = componentHarness("components/auth/login-form.tsx", {
    ...formMocks,
    "next/navigation": { useRouter: () => ({ push: path => routes.push(path), refresh() {} }) },
  }, { FormData: FormDataFixture });
  mode = "error";
  await login.render().props.onSubmit(submitEvent({ email: "test@example.invalid", password }));
  assert.equal(routes.length, 0);
  assert.match(nodes(login.render(), node => node.type === AuthFeedback)[0].props.message, /couldn't sign you in/);
  mode = "success";
  await login.render().props.onSubmit(submitEvent({ email: "test@example.invalid", password }));
  assert.equal(routes.at(-1), "/dashboard");

  let userCalls = 0;
  const ResetPage = load("app/auth/reset-password/page.tsx", {
    "@/components/auth/auth-shell": AuthShell,
    "@/components/auth/reset-password-form": ResetForm,
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => { userCalls++; return { data: { user: null }, error: null }; } } }) },
  }).default;
  assert.equal((await ResetPage({ searchParams: Promise.resolve({}) })).props.children.props.canReset, false);
  await ResetPage({ searchParams: Promise.resolve({ status: "invalid" }) });
  assert.equal(userCalls, 1);

  console.log("PASS: safe login, non-enumerating recovery, password validation, verified session requirement, update/local sign-out outcomes, allowlisted PKCE redirects/flow IDs, cookie adapter, real form markup, password toggle handlers and dashboard routing. No live email/password changes performed.");
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
