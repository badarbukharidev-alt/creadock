# CreaDock External Provider Setup

## Payments

CreaDock’s data model, checkout states, and recurring membership records are ready for live payments. To activate real card checkout, the project owner must add a Stripe Secret Key and Publishable Key in **Settings → Payment**. The current project is not eligible for the claimable Stripe sandbox, so the account owner must provide their own Stripe account credentials. Test keys are suitable for development.

After the keys are added, the implementation should create Stripe Checkout Sessions on the server, open the returned checkout URL in a new browser tab, and verify the `/api/stripe/webhook` signature before granting product, course, or membership entitlements. A live payment account also requires the corresponding production keys after Stripe account verification.

## Email Delivery

CreaDock stores audiences, broadcasts, and welcome-sequence definitions. To send actual email, connect a transactional-email provider such as Resend and supply its server-side API key. The provider must use a verified sending domain, and the platform must send only to opted-in contacts. Scheduled campaigns and delayed sequence steps require a deployed site and a platform-managed scheduled callback; application timers are intentionally not used.

## Calendar Conferencing

Services and availability slots are represented in the application. If creators need automatic calendar events or video-conference links, connect a calendar provider through OAuth and add that provider’s callback credentials. Until this connection is enabled, booking remains a CreaDock-managed availability and appointment workflow.
