# CreaDock Live Version: Features and How They Work

**Live application:** [creadock-pxhwfgh6.manus.space](https://creadock-pxhwfgh6.manus.space)  
**Product:** CreaDock — an all-in-one creator commerce workspace  
**Current sign-in model:** First-party email and password only. There is no Manus login, social login, or third-party OAuth flow.

## 1. What CreaDock Provides

CreaDock lets a creator run a small digital business from one workspace. A creator can build a public storefront, sell digital products, publish courses, take bookings, offer memberships, manage customer records, send marketing email, and review business performance. Customers can buy from a creator’s public storefront and use a separate account area to access what they purchased.

The live application has three practical user types:

| User type | Main area | What they can do |
|---|---|---|
| **Creator** | `/app/dashboard` | Build and operate their storefront, offers, audience, and reporting. |
| **Customer** | `/account` | Access purchases, downloads, courses, bookings, memberships, and account security. |
| **Platform administrator** | `/admin` | Operate CreaDock itself, including users, support, platform records, storage, reporting, and security. |

> A creator’s public storefront always uses the domain that is currently serving CreaDock. At present, a creator link uses the live Manus domain, for example: `https://creadock-pxhwfgh6.manus.space/c/badar`. If `creadock.com` is connected later, the same public-link field automatically uses that domain.

## 2. Account, Login, and Security

Every CreaDock account uses an email address and password. New users sign up, verify their email address, and then sign in to their creator workspace. Passwords are securely hashed, sessions are stored server-side, and the browser receives an HttpOnly session cookie. The application does not expose password values to the browser after submission.

| Security capability | How it works for the user |
|---|---|
| **Sign up** | A user enters their name, username, email, and a strong password. Their account is created in a pending state. |
| **Email verification** | The user opens the verification link sent to their email. Verification activates the account and starts a session. |
| **Login** | A valid email and password create a first-party CreaDock session and open the creator dashboard. |
| **Forgot password** | A password-reset request creates a time-limited reset token. The user chooses a new password through the reset page. |
| **Login protection** | Repeated invalid password attempts are throttled and can temporarily lock the account. |
| **Session management** | A user can review and revoke active sessions from **Account → Security**. |

The dashboard does not run creator-only requests until the session has been resolved. A signed-out visitor who opens `/app/dashboard` sees the CreaDock sign-in gate rather than an application error.

## 3. Creator Workspace

After login, a creator enters `/app/dashboard`. This is the operational center of the product. It has an overview and dedicated areas for the store, products, courses, bookings, memberships, customers, email, and analytics.

### 3.1 Dashboard Overview

The overview presents the core operating metrics for that creator: revenue, recurring revenue, completed orders, customers, storefront views, and conversion. It also shows a revenue trend, recent orders, and shortcuts for creating products, courses, bookings, and membership offers.

The numbers come from the creator’s stored business records. They are not demonstration values: paid orders, memberships, customer records, and storefront visits drive the displayed metrics.

### 3.2 Storefront and Appearance

The **Storefront** area controls the public business profile. A creator can set their display name, unique handle, short bio, publishing state, and accent color. When the storefront is published, visitors can open it at `/c/:handle`.

| Creator action | Result |
|---|---|
| Set a handle, such as `badar` | Creates a public storefront path such as `/c/badar`. |
| Turn on **Publish storefront** | Makes the creator profile and published offers visible to visitors. |
| Update the bio and accent color | Changes the public storefront presentation. |
| Copy public link | Copies the current live-domain storefront URL. |

### 3.3 Digital Products and Offers

Creators can create digital downloads, services, external resources, courses, and membership-linked offers. Each offer has a title, description, price, type, status, and optional attached file.

For a digital offer, the creator uploads a file from the product editor. CreaDock sends the file to managed object storage, records its file reference and byte size, and stores the product record in the database. The creator can keep an offer as a draft, publish it, or archive it.

When a buyer completes a paid purchase, CreaDock creates an order and a digital entitlement. The customer then sees the item in their account library and can request its download link.

### 3.4 Courses

The course workspace lets a creator create a course, add a description, publish or unpublish it, and manage lessons. Lessons can be text, video, or download-based. A creator can add lessons, edit them, remove them, and reorder them.

Customers with a course enrollment use **Account → Learning** to open the course. They can read or view lessons and mark progress complete. CreaDock stores lesson-completion progress against the enrollment, so creators can see learner progress in the course workspace.

### 3.5 Bookings

The booking workspace supports paid or free services such as coaching calls, consultations, or group sessions. A creator defines a service name, duration, capacity, price, and publication state. They then add availability time slots.

On the public storefront, a visitor chooses an available slot and submits a booking. CreaDock stores the appointment and marks the relevant availability appropriately. The creator manages appointment status from the workspace, using statuses such as pending, confirmed, completed, or cancelled.

### 3.6 Memberships

Creators can publish recurring membership plans with a name, price, billing interval, and benefits. Subscribers are listed in the membership workspace with their current status, such as active, past due, paused, or cancelled.

For a Stripe-backed membership, Stripe is responsible for charging the recurring payment. CreaDock receives the verified Stripe subscription event and updates the local subscription record. This keeps customer access and creator records aligned with the payment provider.

### 3.7 Customers and CRM

The customer area is a simple CRM for people who buy, book, enroll, subscribe, or join a mailing audience. A creator can add customer records with a name, email address, tags, and marketing preference.

For an existing customer, CreaDock brings together purchase history, memberships, bookings, and course enrollment activity. This gives the creator one record rather than separate lists for every type of transaction.

### 3.8 Email Marketing

CreaDock includes audience, broadcast, and sequence concepts for creator communication. It also includes transactional message templates for verification, password reset, welcome messages, purchase confirmation, delivery, bookings, and memberships.

Email is only sent when SMTP is configured. The application records delivery attempts and statuses so platform operators can investigate sent, failed, or queued messages.

### 3.9 Analytics

The creator analytics area displays the business signals that matter to a storefront: revenue, recurring revenue, subscriber activity, conversion, orders, and store views. The exact numbers are derived from the creator’s persisted data.

## 4. Customer Experience

A public visitor can open a published storefront at `/c/:handle`. The public store displays the creator profile and currently published offers. The exact purchase path depends on the offer type.

| Customer action | What CreaDock does |
|---|---|
| Purchase a digital product | Starts Stripe Checkout when Stripe is configured; after successful verified payment, creates an order and digital entitlement. |
| Join a membership | Starts a recurring subscription checkout flow; Stripe lifecycle events update the subscription record. |
| Buy a course | Creates course access after valid payment fulfillment. |
| Reserve a booking | Creates a booking against an available creator time slot. |
| Join an email audience | Stores the email subscription in the creator’s audience. |

After a purchase, customers use `/account`. The account portal is their library and service area.

| Customer portal section | Available information and actions |
|---|---|
| **Purchases** | Order history and entitled download access. |
| **Learning** | Course enrollments, lessons, and completion progress. |
| **Bookings** | Current and past appointments. |
| **Memberships** | Active and historical membership status. |
| **Security** | Active sessions and security-event history, with session revocation. |

## 5. Payment Lifecycle

CreaDock is built for Stripe as the payment provider. The intended live payment flow is as follows:

1. The buyer selects a paid offer from the public storefront.
2. CreaDock validates the offer and creates a Stripe Checkout Session on the server.
3. Stripe hosts the secure payment page and processes the payment details.
4. Stripe sends a signed webhook event to CreaDock after the payment or subscription event.
5. CreaDock verifies the webhook signature and records the payment event only once.
6. For a completed purchase, CreaDock creates the applicable access record: a digital entitlement, course enrollment, membership subscription, or related order status.
7. If SMTP is configured, CreaDock queues the relevant transactional confirmation or delivery email.

Refund and recurring-subscription events are also handled. A verified refund can revoke related digital and course access, while subscription updates or cancellations update the local customer-access status.

> Stripe payments are operational only after the Stripe Secret Key, browser Publishable Key, and Webhook Signing Secret have been added in secure project settings. CreaDock intentionally does not expose those secrets in the browser.

## 6. Platform Administration

The administrator area is for operating CreaDock as a platform, not for managing one creator’s individual storefront. Access is role-based. Administrator and super-administrator roles have platform controls; support staff have narrower operational access.

| Admin area | What it provides |
|---|---|
| **Admin overview** | Platform-level accounts, creators, revenue, support, and provider-readiness indicators. |
| **User oversight** | Account status review and role-aware user operations. |
| **Support queue** | Review and update support tickets. |
| **Operations** | Browse recent users, creators, products, orders, payment events, and other operational records. |
| **Reports** | Date-filtered GMV, MRR, paid orders, accounts, store views, subscriptions, support, payment events, storage usage, and growth measures. |
| **Files** | Review product file records, archive or restore their associated offer state, and refresh authoritative storage-byte totals. |
| **Sessions and security** | Review platform sessions and audit events; revoke sessions when necessary. |
| **Email log** | Review transactional email delivery history and failures. |
| **Settings** | Manage saved non-secret controls such as platform name, support email, and public-signup availability. |

Administration actions that change operational records are designed to create audit-log entries. For example, archiving or restoring a product-file record changes the product’s availability state without deleting the stored file or historical purchaser records.

## 7. Current Live Configuration Requirements

The code paths are present, but a real production workflow needs the corresponding provider configuration. The table below separates functionality available now from functionality that needs your configuration.

| Capability | Current application support | What you need to do |
|---|---|---|
| First-party signup and login | Available | Use verified email accounts. |
| Creator storefronts | Available | Create a creator profile, handle, offers, and publish the storefront. |
| File uploads | Available | Upload digital files through the product editor. |
| Stripe one-time payments and subscriptions | Built and ready for activation | Add Stripe secret, publishable, and webhook credentials securely. |
| Payment webhooks | Built and ready for activation | Configure the Stripe webhook endpoint and signing secret. |
| Transactional email and campaign delivery | Built and ready for activation | Add SMTP host, port, username, password, and sender identity securely. |
| Custom domain | Supported by the public-link logic | Connect `creadock.com` in the domain settings. |
| Platform administration | Available for permitted roles | Sign in with an administrator or super-administrator account. |

## 8. Practical Starting Workflow

For the first live creator, the simplest operating sequence is to sign up and verify the account, open **Storefront**, choose a handle, complete the business profile, and publish the storefront. Next, create one product or service, upload its file if it is a digital item, set a price, and publish it. Copy the public link from the Storefront panel and share it.

Before accepting real card payments, configure Stripe and the webhook secret. Before relying on verification or delivery messages, configure SMTP and test a verification email, a password reset email, and one purchase confirmation. Finally, use the customer account portal and the administrator reports to confirm that a complete purchase lifecycle is appearing correctly.

## 9. Important Operational Notes

The live platform is a real data application: product records, customer records, sessions, orders, access entitlements, storage metadata, audit logs, and payment events are persisted. It is not intended to use fake reviews, fake ratings, or fabricated customer activity.

The current live domain is provided by Manus. Connecting your own domain is the final branding step; the creator public-link display already adapts automatically to the active domain.
