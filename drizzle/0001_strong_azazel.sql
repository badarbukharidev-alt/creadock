CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`customerId` int NOT NULL,
	`slotId` int,
	`status` enum('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
	`meetingUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `availabilitySlots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`isBooked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `availabilitySlots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`productId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`coverUrl` varchar(1024),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`handle` varchar(64) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`bio` text,
	`avatarUrl` varchar(1024),
	`theme` enum('minimal','creator','editorial','business','education','dark') NOT NULL DEFAULT 'minimal',
	`accentColor` varchar(16) NOT NULL DEFAULT '#1d4ed8',
	`customDomain` varchar(255),
	`socialLinks` json,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creators_id` PRIMARY KEY(`id`),
	CONSTRAINT `creators_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `creators_handle_unique` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`tags` json,
	`notes` text,
	`stripeCustomerId` varchar(255),
	`marketingOptIn` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_creator_email_idx` UNIQUE(`creatorId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `emailAudiences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailAudiences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`audienceId` int,
	`subject` varchar(255) NOT NULL,
	`previewText` varchar(255),
	`body` text NOT NULL,
	`status` enum('draft','scheduled','sent') NOT NULL DEFAULT 'draft',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`schedule_cron_task_uid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailSequenceSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequenceId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`delayDays` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailSequenceSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`trigger` enum('signup','purchase','enrollment') NOT NULL DEFAULT 'signup',
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`customerId` int NOT NULL,
	`completedLessonIds` json NOT NULL DEFAULT ('[]'),
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollments_course_customer_idx` UNIQUE(`courseId`,`customerId`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`kind` enum('text','video','download') NOT NULL DEFAULT 'text',
	`body` text,
	`videoUrl` varchar(1024),
	`fileUrl` varchar(1024),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPreview` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membershipPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`benefits` json NOT NULL DEFAULT ('[]'),
	`price` decimal(10,2) NOT NULL,
	`interval` enum('month','year') NOT NULL DEFAULT 'month',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`stripeProductId` varchar(255),
	`stripePriceId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `membershipPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`membershipPlanId` int,
	`title` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`customerId` int,
	`orderNumber` varchar(64) NOT NULL,
	`status` enum('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending',
	`total` decimal(10,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`type` enum('digital','course','service','membership','external') NOT NULL DEFAULT 'digital',
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`compareAtPrice` decimal(10,2),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`thumbnailUrl` varchar(1024),
	`fileKey` varchar(1024),
	`fileUrl` varchar(1024),
	`externalUrl` varchar(1024),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`stripeProductId` varchar(255),
	`stripePriceId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_creator_slug_idx` UNIQUE(`creatorId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`durationMinutes` int NOT NULL DEFAULT 30,
	`capacity` int NOT NULL DEFAULT 1,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storeVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`visitorKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storeVisits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storefrontBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`type` enum('profile','text','button','social','product','productGrid','course','booking','image','email','membership','faq','embed') NOT NULL,
	`title` varchar(255),
	`content` json NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storefrontBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`customerId` int NOT NULL,
	`stripeSubscriptionId` varchar(255),
	`status` enum('active','past_due','cancelled','paused') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supportTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int,
	`subject` varchar(255) NOT NULL,
	`status` enum('open','in_progress','resolved') NOT NULL DEFAULT 'open',
	`priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_slotId_availabilitySlots_id_fk` FOREIGN KEY (`slotId`) REFERENCES `availabilitySlots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `availabilitySlots` ADD CONSTRAINT `availabilitySlots_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creators` ADD CONSTRAINT `creators_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailAudiences` ADD CONSTRAINT `emailAudiences_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailCampaigns` ADD CONSTRAINT `emailCampaigns_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailCampaigns` ADD CONSTRAINT `emailCampaigns_audienceId_emailAudiences_id_fk` FOREIGN KEY (`audienceId`) REFERENCES `emailAudiences`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailSequenceSteps` ADD CONSTRAINT `emailSequenceSteps_sequenceId_emailSequences_id_fk` FOREIGN KEY (`sequenceId`) REFERENCES `emailSequences`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailSequences` ADD CONSTRAINT `emailSequences_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membershipPlans` ADD CONSTRAINT `membershipPlans_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_membershipPlanId_membershipPlans_id_fk` FOREIGN KEY (`membershipPlanId`) REFERENCES `membershipPlans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storeVisits` ADD CONSTRAINT `storeVisits_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storefrontBlocks` ADD CONSTRAINT `storefrontBlocks_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_membershipPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `membershipPlans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportTickets` ADD CONSTRAINT `supportTickets_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointments_service_idx` ON `appointments` (`serviceId`);--> statement-breakpoint
CREATE INDEX `availability_service_starts_idx` ON `availabilitySlots` (`serviceId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `courses_creator_idx` ON `courses` (`creatorId`);--> statement-breakpoint
CREATE INDEX `creators_handle_idx` ON `creators` (`handle`);--> statement-breakpoint
CREATE INDEX `customers_creator_idx` ON `customers` (`creatorId`);--> statement-breakpoint
CREATE INDEX `email_audiences_creator_idx` ON `emailAudiences` (`creatorId`);--> statement-breakpoint
CREATE INDEX `email_campaigns_creator_idx` ON `emailCampaigns` (`creatorId`);--> statement-breakpoint
CREATE INDEX `email_campaigns_task_uid_idx` ON `emailCampaigns` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `email_sequence_steps_idx` ON `emailSequenceSteps` (`sequenceId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `email_sequences_creator_idx` ON `emailSequences` (`creatorId`);--> statement-breakpoint
CREATE INDEX `lessons_course_idx` ON `lessons` (`courseId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `membership_plans_creator_idx` ON `membershipPlans` (`creatorId`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_creator_status_idx` ON `orders` (`creatorId`,`status`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customerId`);--> statement-breakpoint
CREATE INDEX `products_creator_status_idx` ON `products` (`creatorId`,`status`);--> statement-breakpoint
CREATE INDEX `services_creator_idx` ON `services` (`creatorId`);--> statement-breakpoint
CREATE INDEX `store_visits_creator_idx` ON `storeVisits` (`creatorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `storefront_blocks_creator_idx` ON `storefrontBlocks` (`creatorId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `subscriptions_customer_idx` ON `subscriptions` (`customerId`);--> statement-breakpoint
CREATE INDEX `subscriptions_plan_idx` ON `subscriptions` (`planId`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `supportTickets` (`status`);