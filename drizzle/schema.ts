import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  normalizedEmail: varchar("normalizedEmail", { length: 320 }),
  username: varchar("username", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  accountStatus: mysqlEnum("accountStatus", ["pending", "active", "suspended"]).default("pending").notNull(),
  failedLoginCount: int("failedLoginCount").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  lastPasswordChangedAt: timestamp("lastPasswordChangedAt"),
  role: mysqlEnum("role", ["user", "admin", "super_admin", "support"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [uniqueIndex("users_normalized_email_idx").on(table.normalizedEmail), uniqueIndex("users_username_idx").on(table.username), index("users_status_idx").on(table.accountStatus)]);

export const userSessions = mysqlTable("userSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("user_sessions_user_idx").on(table.userId), index("user_sessions_expiry_idx").on(table.expiresAt)]);

export const authTokens = mysqlTable("authTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["email_verification", "password_reset"]).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("auth_tokens_user_type_idx").on(table.userId, table.type), index("auth_tokens_expiry_idx").on(table.expiresAt)]);

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId)]);

export const creators = mysqlTable("creators", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  handle: varchar("handle", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  headline: varchar("headline", { length: 220 }),
  bio: text("bio"),
  location: varchar("location", { length: 160 }),
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  logoUrl: varchar("logoUrl", { length: 1024 }),
  coverUrl: varchar("coverUrl", { length: 1024 }),
  theme: mysqlEnum("theme", ["minimal", "creator", "editorial", "business", "education", "dark"]).default("minimal").notNull(),
  accentColor: varchar("accentColor", { length: 16 }).default("#1d4ed8").notNull(),
  visualSettings: json("visualSettings").$type<{ backgroundColor?: string; textColor?: string; cardColor?: string; buttonColor?: string; buttonTextColor?: string; buttonStyle?: "solid" | "outline" | "soft" | "minimal"; borderRadius?: "sm" | "md" | "lg"; font?: "sans" | "serif" | "mono"; layoutWidth?: "narrow" | "standard" | "wide"; spacing?: "compact" | "comfortable" | "spacious" }>(),
  customDomain: varchar("customDomain", { length: 255 }),
  socialLinks: json("socialLinks").$type<Array<{ label: string; url: string }>>(),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("creators_handle_idx").on(table.handle)]);

export const storefrontBlocks = mysqlTable("storefrontBlocks", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["profile", "heading", "text", "button", "social", "product", "productGrid", "course", "booking", "image", "video", "gallery", "divider", "email", "membership", "faq", "testimonial", "countdown", "embed", "html"]).notNull(),
  title: varchar("title", { length: 255 }),
  content: json("content").$type<Record<string, unknown>>().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("storefront_blocks_creator_idx").on(table.creatorId, table.sortOrder)]);

export const mediaFolders = mysqlTable("mediaFolders", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  parentId: int("parentId"),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("media_folders_creator_idx").on(table.creatorId), index("media_folders_parent_idx").on(table.parentId)]);

export const mediaAssets = mysqlTable("mediaAssets", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  folderId: int("folderId").references(() => mediaFolders.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  kind: mysqlEnum("kind", ["image", "video", "audio", "document", "archive", "other"]).default("other").notNull(),
  sizeBytes: int("sizeBytes").default(0).notNull(),
  width: int("width"),
  height: int("height"),
  durationSeconds: int("durationSeconds"),
  altText: varchar("altText", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("media_assets_creator_idx").on(table.creatorId, table.createdAt), index("media_assets_folder_idx").on(table.folderId), index("media_assets_kind_idx").on(table.creatorId, table.kind)]);

export const creatorPages = mysqlTable("creatorPages", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  kind: mysqlEnum("kind", ["home", "links", "about", "products", "services", "courses", "contact", "custom"]).default("custom").notNull(),
  template: mysqlEnum("template", ["creator", "coach", "consultant", "educator", "artist", "agency", "products", "newsletter"]).default("creator").notNull(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  seoTitle: varchar("seoTitle", { length: 180 }),
  seoDescription: varchar("seoDescription", { length: 320 }),
  socialImageAssetId: int("socialImageAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("creator_pages_creator_slug_idx").on(table.creatorId, table.slug), index("creator_pages_creator_status_idx").on(table.creatorId, table.status)]);

export const pageBlocks = mysqlTable("pageBlocks", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("pageId").notNull().references(() => creatorPages.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["profile", "heading", "text", "link", "product", "productGrid", "course", "booking", "membership", "social", "image", "video", "gallery", "divider", "email", "faq", "countdown", "embed", "html"]).notNull(),
  content: json("content").$type<Record<string, unknown>>().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("page_blocks_page_idx").on(table.pageId, table.sortOrder)]);

export const creatorLinks = mysqlTable("creatorLinks", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  pageId: int("pageId").references(() => creatorPages.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  description: varchar("description", { length: 320 }),
  icon: varchar("icon", { length: 80 }),
  thumbnailAssetId: int("thumbnailAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  openInNewTab: boolean("openInNewTab").default(true).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  publishedAt: timestamp("publishedAt"),
  expiresAt: timestamp("expiresAt"),
  clickCount: int("clickCount").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("creator_links_creator_idx").on(table.creatorId, table.sortOrder), index("creator_links_page_idx").on(table.pageId)]);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["digital", "course", "service", "membership", "external"]).default("digital").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
  heroAssetId: int("heroAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  shortDescription: varchar("shortDescription", { length: 420 }),
  benefits: json("benefits").$type<string[]>(),
  productPageSettings: json("productPageSettings").$type<{ ctaLabel?: string; layout?: "standard" | "editorial" | "minimal"; seoTitle?: string; seoDescription?: string; checkoutMessage?: string; collectPhone?: boolean; collectAddress?: boolean }>(),
  visibility: mysqlEnum("visibility", ["public", "unlisted", "private"]).default("public").notNull(),
  fulfillmentType: mysqlEnum("fulfillmentType", ["digital", "redirect", "manual", "none"]).default("digital").notNull(),
  inventoryLimit: int("inventoryLimit"),
  inventorySold: int("inventorySold").default(0).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }),
  fileUrl: varchar("fileUrl", { length: 1024 }),
  fileSizeBytes: int("fileSizeBytes", { unsigned: true }).default(0).notNull(),
  externalUrl: varchar("externalUrl", { length: 1024 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("products_creator_slug_idx").on(table.creatorId, table.slug), index("products_creator_status_idx").on(table.creatorId, table.status)]);

export const productVariants = mysqlTable("productVariants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  priceDelta: decimal("priceDelta", { precision: 10, scale: 2 }).default("0.00").notNull(),
  inventoryLimit: int("inventoryLimit"),
  inventorySold: int("inventorySold").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("product_variants_product_idx").on(table.productId, table.sortOrder)]);

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["percent", "fixed"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  minimumAmount: decimal("minimumAmount", { precision: 10, scale: 2 }),
  maxRedemptions: int("maxRedemptions"),
  redemptions: int("redemptions").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("coupons_creator_code_idx").on(table.creatorId, table.code), index("coupons_creator_active_idx").on(table.creatorId, table.isActive)]);

export const productBundles = mysqlTable("productBundles", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("product_bundles_creator_slug_idx").on(table.creatorId, table.slug), index("product_bundles_creator_status_idx").on(table.creatorId, table.status)]);

export const bundleItems = mysqlTable("bundleItems", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundleId").notNull().references(() => productBundles.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  sortOrder: int("sortOrder").default(0).notNull(),
}, (table) => [uniqueIndex("bundle_items_bundle_product_idx").on(table.bundleId, table.productId), index("bundle_items_bundle_idx").on(table.bundleId, table.sortOrder)]);

/** Singleton, non-secret platform controls. Provider credentials remain environment-only. */
export const platformSettings = mysqlTable("platformSettings", {
  id: int("id").primaryKey(),
  platformName: varchar("platformName", { length: 120 }).default("CreaDock").notNull(),
  supportEmail: varchar("supportEmail", { length: 320 }),
  allowPublicSignups: boolean("allowPublicSignups").default(true).notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: varchar("coverUrl", { length: 1024 }),
  thumbnailAssetId: int("thumbnailAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  coverAssetId: int("coverAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  learningOutcomes: json("learningOutcomes").$type<string[]>(),
  settings: json("settings").$type<{ instructorName?: string; welcomeMessage?: string; certificateEnabled?: boolean }>(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("courses_creator_idx").on(table.creatorId)]);

export const courseModules = mysqlTable("courseModules", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageAssetId: int("imageAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  dripDays: int("dripDays").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("course_modules_course_idx").on(table.courseId, table.sortOrder)]);

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  moduleId: int("moduleId").references(() => courseModules.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["text", "video", "audio", "image", "download", "quiz"]).default("text").notNull(),
  body: text("body"),
  videoUrl: varchar("videoUrl", { length: 1024 }),
  fileUrl: varchar("fileUrl", { length: 1024 }),
  mediaAssetId: int("mediaAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  thumbnailAssetId: int("thumbnailAssetId").references(() => mediaAssets.id, { onDelete: "set null" }),
  galleryAssetIds: json("galleryAssetIds").$type<number[]>(),
  resourceAssetIds: json("resourceAssetIds").$type<number[]>(),
  durationSeconds: int("durationSeconds"),
  quiz: json("quiz").$type<{ prompt: string; choices: string[]; correctAnswerIndex: number; explanation?: string; passingScore?: number }>(),
  isPublished: boolean("isPublished").default(true).notNull(),
  isLocked: boolean("isLocked").default(false).notNull(),
  dripDays: int("dripDays").default(0).notNull(),
  prerequisiteLessonId: int("prerequisiteLessonId").references((): any => lessons.id, { onDelete: "set null" }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPreview: boolean("isPreview").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("lessons_course_idx").on(table.courseId, table.sortOrder), index("lessons_module_idx").on(table.moduleId, table.sortOrder), index("lessons_prerequisite_idx").on(table.prerequisiteLessonId)]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  tags: json("tags").$type<string[]>(),
  notes: text("notes"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  marketingOptIn: boolean("marketingOptIn").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("customers_creator_email_idx").on(table.creatorId, table.email), index("customers_creator_idx").on(table.creatorId), index("customers_user_idx").on(table.userId)]);

export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  membershipPlanId: int("membershipPlanId").references(() => membershipPlans.id, { onDelete: "set null" }),
  completedLessonIds: json("completedLessonIds").$type<number[]>().notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [uniqueIndex("enrollments_course_customer_idx").on(table.courseId, table.customerId), index("enrollments_membership_plan_idx").on(table.membershipPlanId)]);

export const lessonQuizAttempts = mysqlTable("lessonQuizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: int("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  selectedAnswerIndex: int("selectedAnswerIndex").notNull(),
  score: int("score").notNull(),
  isPassed: boolean("isPassed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("lesson_quiz_attempts_enrollment_idx").on(table.enrollmentId, table.lessonId), index("lesson_quiz_attempts_lesson_idx").on(table.lessonId)]);

export const digitalEntitlements = mysqlTable("digitalEntitlements", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  deliveryUrl: varchar("deliveryUrl", { length: 1024 }),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("digital_entitlements_customer_product_idx").on(table.customerId, table.productId), index("digital_entitlements_order_idx").on(table.orderId)]);

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sessionType: mysqlEnum("sessionType", ["one_to_one", "group"]).default("one_to_one").notNull(),
  durationMinutes: int("durationMinutes").default(30).notNull(),
  bufferMinutes: int("bufferMinutes").default(0).notNull(),
  capacity: int("capacity").default(1).notNull(),
  timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),
  locationType: mysqlEnum("locationType", ["online", "in_person", "phone", "custom"]).default("online").notNull(),
  locationDetails: varchar("locationDetails", { length: 1024 }),
  intakeQuestions: json("intakeQuestions").$type<Array<{ id: string; label: string; required?: boolean; type?: "short_text" | "long_text" | "select"; options?: string[] }>>(),
  bookingNoticeHours: int("bookingNoticeHours").default(0).notNull(),
  reminderLeadHours: int("reminderLeadHours").default(24).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("services_creator_idx").on(table.creatorId)]);

export const availabilitySlots = mysqlTable("availabilitySlots", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  reservedCount: int("reservedCount").default(0).notNull(),
  isBooked: boolean("isBooked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("availability_service_starts_idx").on(table.serviceId, table.startsAt)]);

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  slotId: int("slotId").references(() => availabilitySlots.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).default("pending").notNull(),
  meetingUrl: varchar("meetingUrl", { length: 1024 }),
  intakeResponses: json("intakeResponses").$type<Record<string, string>>(),
  customerTimezone: varchar("customerTimezone", { length: 80 }),
  creatorNotes: text("creatorNotes"),
  cancelledAt: timestamp("cancelledAt"),
  reminderAt: timestamp("reminderAt"),
  reminderSentAt: timestamp("reminderSentAt"),
  reminderScheduleTaskUid: varchar("reminderScheduleTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("appointments_service_idx").on(table.serviceId), index("appointments_reminder_task_idx").on(table.reminderScheduleTaskUid)]);

export const bookingBlackouts = mysqlTable("bookingBlackouts", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("booking_blackouts_service_time_idx").on(table.serviceId, table.startsAt)]);

export const membershipPlans = mysqlTable("membershipPlans", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  benefits: json("benefits").$type<string[]>().notNull(),
  accessRules: json("accessRules").$type<{ includedProductIds?: number[]; includedCourseIds?: number[]; includedCommunityIds?: number[]; exclusiveContent?: string }>(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  interval: mysqlEnum("interval", ["month", "year"]).default("month").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  stripeProductId: varchar("stripeProductId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("membership_plans_creator_idx").on(table.creatorId)]);

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => membershipPlans.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  status: mysqlEnum("status", ["active", "past_due", "cancelled", "paused"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("subscriptions_customer_idx").on(table.customerId), index("subscriptions_plan_idx").on(table.planId)]);

export const communitySpaces = mysqlTable("communitySpaces", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  accessType: mysqlEnum("accessType", ["public", "members", "product"]).default("members").notNull(),
  membershipPlanId: int("membershipPlanId").references(() => membershipPlans.id, { onDelete: "set null" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("community_spaces_creator_idx").on(table.creatorId), index("community_spaces_access_idx").on(table.accessType, table.isPublished)]);

export const communityMembers = mysqlTable("communityMembers", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull().references(() => communitySpaces.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["member", "moderator"]).default("member").notNull(),
  status: mysqlEnum("status", ["active", "removed"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("community_members_community_customer_idx").on(table.communityId, table.customerId), index("community_members_customer_idx").on(table.customerId, table.status)]);

export const communityPosts = mysqlTable("communityPosts", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull().references(() => communitySpaces.id, { onDelete: "cascade" }),
  authorCustomerId: int("authorCustomerId").references(() => customers.id, { onDelete: "set null" }),
  authorUserId: int("authorUserId").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  isAnnouncement: boolean("isAnnouncement").default(false).notNull(),
  status: mysqlEnum("status", ["published", "hidden"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("community_posts_feed_idx").on(table.communityId, table.createdAt), index("community_posts_author_idx").on(table.authorCustomerId)]);

export const communityComments = mysqlTable("communityComments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  authorCustomerId: int("authorCustomerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("community_comments_post_idx").on(table.postId, table.createdAt)]);

export const communityPostLikes = mysqlTable("communityPostLikes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("community_post_likes_post_customer_idx").on(table.postId, table.customerId), index("community_post_likes_post_idx").on(table.postId)]);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "paid", "refunded", "cancelled"]).default("pending").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("orders_creator_status_idx").on(table.creatorId, table.status), index("orders_customer_idx").on(table.customerId), uniqueIndex("orders_stripe_checkout_session_idx").on(table.stripeCheckoutSessionId)]);

export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  membershipPlanId: int("membershipPlanId").references(() => membershipPlans.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const storeVisits = mysqlTable("storeVisits", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  visitorKey: varchar("visitorKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("store_visits_creator_idx").on(table.creatorId, table.createdAt)]);

export const emailAudiences = mysqlTable("emailAudiences", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("email_audiences_creator_idx").on(table.creatorId)]);

export const emailCampaigns = mysqlTable("emailCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  audienceId: int("audienceId").references(() => emailAudiences.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  previewText: varchar("previewText", { length: 255 }),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["draft", "scheduled", "sent"]).default("draft").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  sentAt: timestamp("sentAt"),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("email_campaigns_creator_idx").on(table.creatorId), index("email_campaigns_task_uid_idx").on(table.scheduleCronTaskUid)]);

export const emailSequences = mysqlTable("emailSequences", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").notNull().references(() => creators.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  trigger: mysqlEnum("trigger", ["signup", "purchase", "enrollment"]).default("signup").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("email_sequences_creator_idx").on(table.creatorId)]);

export const emailSequenceSteps = mysqlTable("emailSequenceSteps", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequenceId").notNull().references(() => emailSequences.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  delayDays: int("delayDays").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("email_sequence_steps_idx").on(table.sequenceId, table.sortOrder)]);

export const emailDeliveries = mysqlTable("emailDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").references(() => creators.id, { onDelete: "set null" }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => emailCampaigns.id, { onDelete: "set null" }),
  kind: mysqlEnum("kind", ["verification", "password_reset", "welcome", "purchase_confirmation", "product_delivery", "booking_confirmation", "booking_reminder", "membership_confirmation", "broadcast"]).notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "failed", "bounced", "unsubscribed"]).default("queued").notNull(),
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("email_deliveries_creator_idx").on(table.creatorId, table.createdAt), index("email_deliveries_status_idx").on(table.status, table.createdAt), index("email_deliveries_campaign_idx").on(table.campaignId)]);

export const paymentEvents = mysqlTable("paymentEvents", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["stripe"]).default("stripe").notNull(),
  providerEventId: varchar("providerEventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 160 }).notNull(),
  orderId: int("orderId").references(() => orders.id, { onDelete: "set null" }),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["received", "processed", "failed"]).default("received").notNull(),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  occurredAt: timestamp("occurredAt").notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("payment_events_status_idx").on(table.status, table.createdAt), index("payment_events_order_idx").on(table.orderId)]);

export const supportTickets = mysqlTable("supportTickets", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creatorId").references(() => creators.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high"]).default("normal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("support_tickets_status_idx").on(table.status)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
