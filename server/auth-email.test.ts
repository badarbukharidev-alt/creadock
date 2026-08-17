import { afterEach, describe, expect, it, vi } from "vitest";
import { isInitialAdminEmail, normalizeEmail, normalizeUsername, sessionTokenFromRequest, validatePassword } from "./auth";
import { emailTemplates } from "./email";
import { smtpStatus } from "./email";
import { stripeProvider, stripeStatus } from "./payments";

describe("first-party credential rules", () => {
  it("normalizes email addresses before uniqueness checks", () => expect(normalizeEmail("  CREATOR@Example.COM ")).toBe("creator@example.com"));
  it("normalizes usernames into a stable lookup key", () => expect(normalizeUsername("  Creator_Name ")).toBe("creator_name"));
  it("recognizes the configured initial administrator identity", () => {
    expect(process.env.ADMIN_EMAIL).toBeTruthy();
    expect(isInitialAdminEmail(process.env.ADMIN_EMAIL || "")).toBe(true);
  });
  it("accepts the supplied initial administrator password under the password policy", () => {
    expect(process.env.INITIAL_ADMIN_PASSWORD).toBeTruthy();
    expect(validatePassword(process.env.INITIAL_ADMIN_PASSWORD || "")).toBeNull();
  });
  it("accepts a sufficiently varied password", () => expect(validatePassword("Stronger!Pass123")).toBeNull());
  it("rejects passwords shorter than the minimum", () => expect(validatePassword("Short!123")).toContain("12"));
  it("rejects passwords without all character classes", () => expect(validatePassword("alllowercasepassword123")).toContain("upper"));
  it("rejects a password with no lowercase character", () => expect(validatePassword("UPPERCASE!12345")).toContain("lower"));
  it("rejects a password with no number", () => expect(validatePassword("NoNumbers!Password")).toContain("number"));
  it("rejects a password with no symbol", () => expect(validatePassword("NoSymbolsPassword123")).toContain("symbol"));
  it("accepts the maximum supported password length", () => expect(validatePassword(`Strong!Pass123${"A".repeat(114)}`)).toBeNull());
  it("rejects passwords above the maximum supported length", () => expect(validatePassword(`Strong!Pass123${"A".repeat(115)}`)).toContain("12"));
  it("preserves a normalized email with plus addressing", () => expect(normalizeEmail("Creator+Store@Example.com")).toBe("creator+store@example.com"));
  it("preserves supported username separators", () => expect(normalizeUsername("store-name_01")).toBe("store-name_01"));
  it("does not grant initial administrator status to a different email address", () => expect(isInitialAdminEmail("another-admin@example.com")).toBe(false));
  it("extracts a first-party session from a raw HTTP cookie header when Express cookie middleware is absent", () => {
    const token = "session-id.session-secret";
    expect(sessionTokenFromRequest({ cookies: undefined, headers: { cookie: `theme=light; creadock_session=${token}; locale=en` } } as never)).toBe(token);
  });
});

describe("transactional templates", () => {
  it("creates a verification link with the supplied one-time token", () => {
    const email = emailTemplates.verification("Avery", "safe-token-123456789012", { headers: { origin: "https://creadock.example" } } as never);
    expect(email.subject).toContain("Verify");
    expect(email.html).toContain("verify-email?token=safe-token-123456789012");
  });
  it("creates a reset link without exposing a password", () => {
    const email = emailTemplates.passwordReset("Avery", "reset-token-123456789012", { headers: { origin: "https://creadock.example" } } as never);
    expect(email.html).toContain("reset-password?token=reset-token-123456789012");
    expect(email.text.toLowerCase()).not.toContain("current password");
  });
  it("escapes untrusted names in transactional HTML", () => {
    const email = emailTemplates.welcome("<script>alert(1)</script>");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
  it("creates a professional purchase confirmation", () => expect(emailTemplates.purchase("Avery", "Creator Kit").subject).toContain("purchase"));
  it("creates a gated-product delivery call to action", () => expect(emailTemplates.delivery("Avery", "Creator Kit", "https://access.example/file").html).toContain("Access your product"));
  it("creates a booking confirmation", () => expect(emailTemplates.booking("Avery", "Office hours").subject).toContain("booking"));
  it("creates a membership confirmation", () => expect(emailTemplates.membership("Avery", "Studio").text).toContain("Studio"));
});

describe("provider configuration guards", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reports SMTP as unavailable when a required setting is absent", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com"); vi.stubEnv("SMTP_PORT", "587"); vi.stubEnv("SMTP_USERNAME", "user"); vi.stubEnv("SMTP_PASSWORD", ""); vi.stubEnv("EMAIL_FROM", "CreaDock <no-reply@example.com>");
    expect(smtpStatus().configured).toBe(false);
  });
  it("reports SMTP as ready when the full server configuration exists", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com"); vi.stubEnv("SMTP_PORT", "587"); vi.stubEnv("SMTP_USERNAME", "user"); vi.stubEnv("SMTP_PASSWORD", "secret"); vi.stubEnv("EMAIL_FROM", "CreaDock <no-reply@example.com>");
    expect(smtpStatus()).toMatchObject({ configured: true, host: "smtp.example.com", port: 587 });
  });
  it("reports Stripe as unavailable without all three required keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x"); vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(stripeStatus().configured).toBe(false);
  });
  it("reports Stripe as ready when API, browser, and webhook keys are present", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x"); vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(stripeStatus().configured).toBe(true);
  });
  it("reports the Stripe publishable-key state independently", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", ""); vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(stripeStatus().publishableKeyConfigured).toBe(true);
  });
  it("reports the Stripe webhook state independently", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", ""); vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", ""); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    expect(stripeStatus().webhookConfigured).toBe(true);
  });
  it("rejects sub-minimum Stripe Checkout amounts before contacting the provider", async () => {
    await expect(stripeProvider.createCheckout({ orderId: 1, customerEmail: "buyer@example.com", title: "Tiny", amount: "0.10", currency: "USD", mode: "payment", successUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel", metadata: {} })).rejects.toThrow("at least 0.50");
  });
});
