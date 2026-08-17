CREATE TABLE `bookingBlackouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`reason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookingBlackouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communityComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`authorCustomerId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communityMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`customerId` int NOT NULL,
	`role` enum('member','moderator') NOT NULL DEFAULT 'member',
	`status` enum('active','removed') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_members_community_customer_idx` UNIQUE(`communityId`,`customerId`)
);
--> statement-breakpoint
CREATE TABLE `communityPostLikes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`customerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityPostLikes_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_post_likes_post_customer_idx` UNIQUE(`postId`,`customerId`)
);
--> statement-breakpoint
CREATE TABLE `communityPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`authorCustomerId` int,
	`authorUserId` int,
	`title` varchar(255),
	`body` text NOT NULL,
	`isAnnouncement` boolean NOT NULL DEFAULT false,
	`status` enum('published','hidden') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communityPosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communitySpaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text,
	`accessType` enum('public','members','product') NOT NULL DEFAULT 'members',
	`membershipPlanId` int,
	`productId` int,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communitySpaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `intakeResponses` json;--> statement-breakpoint
ALTER TABLE `appointments` ADD `customerTimezone` varchar(80);--> statement-breakpoint
ALTER TABLE `appointments` ADD `creatorNotes` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `availabilitySlots` ADD `reservedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `membershipPlans` ADD `accessRules` json;--> statement-breakpoint
ALTER TABLE `services` ADD `sessionType` enum('one_to_one','group') DEFAULT 'one_to_one' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `bufferMinutes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `timezone` varchar(80) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `locationType` enum('online','in_person','phone','custom') DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `locationDetails` varchar(1024);--> statement-breakpoint
ALTER TABLE `services` ADD `intakeQuestions` json;--> statement-breakpoint
ALTER TABLE `services` ADD `bookingNoticeHours` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookingBlackouts` ADD CONSTRAINT `bookingBlackouts_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityComments` ADD CONSTRAINT `communityComments_postId_communityPosts_id_fk` FOREIGN KEY (`postId`) REFERENCES `communityPosts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityComments` ADD CONSTRAINT `communityComments_authorCustomerId_customers_id_fk` FOREIGN KEY (`authorCustomerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityMembers` ADD CONSTRAINT `communityMembers_communityId_communitySpaces_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communitySpaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityMembers` ADD CONSTRAINT `communityMembers_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityPostLikes` ADD CONSTRAINT `communityPostLikes_postId_communityPosts_id_fk` FOREIGN KEY (`postId`) REFERENCES `communityPosts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityPostLikes` ADD CONSTRAINT `communityPostLikes_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityPosts` ADD CONSTRAINT `communityPosts_communityId_communitySpaces_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communitySpaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityPosts` ADD CONSTRAINT `communityPosts_authorCustomerId_customers_id_fk` FOREIGN KEY (`authorCustomerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityPosts` ADD CONSTRAINT `communityPosts_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communitySpaces` ADD CONSTRAINT `communitySpaces_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communitySpaces` ADD CONSTRAINT `communitySpaces_membershipPlanId_membershipPlans_id_fk` FOREIGN KEY (`membershipPlanId`) REFERENCES `membershipPlans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communitySpaces` ADD CONSTRAINT `communitySpaces_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `booking_blackouts_service_time_idx` ON `bookingBlackouts` (`serviceId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `community_comments_post_idx` ON `communityComments` (`postId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `community_members_customer_idx` ON `communityMembers` (`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `community_post_likes_post_idx` ON `communityPostLikes` (`postId`);--> statement-breakpoint
CREATE INDEX `community_posts_feed_idx` ON `communityPosts` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `community_posts_author_idx` ON `communityPosts` (`authorCustomerId`);--> statement-breakpoint
CREATE INDEX `community_spaces_creator_idx` ON `communitySpaces` (`creatorId`);--> statement-breakpoint
CREATE INDEX `community_spaces_access_idx` ON `communitySpaces` (`accessType`,`isPublished`);