# CreaDock Production Activation

## First-party accounts

CreaDock uses its own email-and-password identity layer. New users register at `/signup`, confirm their email through a single-use verification link, and sign in at `/login`. Passwords are bcrypt-hashed and never stored in clear text. Sessions are server-side, expire according to the keep-signed-in setting, can be revoked, and are represented by an HTTP-only cookie.

The configured administrator email receives `SUPER_ADMIN` only after the normal first-party account creation path. The initial administrator was provisioned as a verified, active account. Rotate the initial provisioning password after the first successful sign-in and never reuse it elsewhere.

## Stripe activation

Open **Settings → Payment** and provide the Stripe Secret Key, Publishable Key, and Webhook Signing Secret. Use test-mode credentials first. Configure Stripe to post these events to:

```
https://YOUR_DOMAIN/api/stripe/webhook
```

The webhook handler verifies Stripe’s signature before processing an event, records the provider event ID once, and finalizes a pending order only after `checkout.session.completed`. That flow grants digital entitlements, enrolls linked courses, and activates local memberships. Test the webhook in Stripe’s dashboard before switching to live keys.

## SMTP activation

Configure the following server-side values in the secure project settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `EMAIL_FROM`. The sender identity must belong to a verified sending domain. CreaDock records every transactional delivery attempt in `emailDeliveries`; it sends verification, password reset, welcome, purchase confirmation, product delivery, booking confirmation, and membership confirmation templates.

SMTP credentials must remain server-side. The CreaDock admin console intentionally shows only readiness and sender information; it never displays or accepts raw credentials in the browser.

## Customer access

Customers sign in at `/login` and access `/account`. The portal lists paid orders, course enrollments, appointments, and memberships. Digital downloads are authorized server-side by matching the signed-in user to their creator CRM record and a persisted entitlement; private files are delivered through short-lived storage URLs.

## Operational checks

Before publishing, confirm that the dashboard shows Stripe and SMTP as **Ready**, exercise a test payment and verified webhook, send a verification email to a controlled mailbox, sign in as a customer, and download a paid file through `/account`. Review `auditLogs`, `paymentEvents`, and `emailDeliveries` after each test. Suspended accounts must not be allowed to sign in, and platform staff should use the admin panel rather than direct database modifications for ordinary account management.

## Current activation boundary

The platform code, schema, real checkout flow, verified webhook endpoint, SMTP abstraction, and delivery records are in place. Live provider execution begins only after the project owner enters their own Stripe and SMTP credentials in the secure settings. Scheduled marketing sends require a deployed scheduled-task configuration; do not use in-process timers for that work.
