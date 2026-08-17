CREATE TABLE `emailDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int,
	`userId` int,
	`customerId` int,
	`campaignId` int,
	`kind` enum('verification','password_reset','welcome','purchase_confirmation','product_delivery','booking_confirmation','membership_confirmation','broadcast') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` enum('queued','sent','failed','bounced','unsubscribed') NOT NULL DEFAULT 'queued',
	`providerMessageId` varchar(255),
	`errorMessage` varchar(1000),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailDeliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paymentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('stripe') NOT NULL DEFAULT 'stripe',
	`providerEventId` varchar(255) NOT NULL,
	`eventType` varchar(160) NOT NULL,
	`orderId` int,
	`subscriptionId` int,
	`status` enum('received','processed','failed') NOT NULL DEFAULT 'received',
	`errorMessage` varchar(1000),
	`occurredAt` timestamp NOT NULL,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentEvents_providerEventId_unique` UNIQUE(`providerEventId`)
);
--> statement-breakpoint
ALTER TABLE `emailDeliveries` ADD CONSTRAINT `emailDeliveries_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailDeliveries` ADD CONSTRAINT `emailDeliveries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailDeliveries` ADD CONSTRAINT `emailDeliveries_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailDeliveries` ADD CONSTRAINT `emailDeliveries_campaignId_emailCampaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `emailCampaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paymentEvents` ADD CONSTRAINT `paymentEvents_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paymentEvents` ADD CONSTRAINT `paymentEvents_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_deliveries_creator_idx` ON `emailDeliveries` (`creatorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `email_deliveries_status_idx` ON `emailDeliveries` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `email_deliveries_campaign_idx` ON `emailDeliveries` (`campaignId`);--> statement-breakpoint
CREATE INDEX `payment_events_status_idx` ON `paymentEvents` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payment_events_order_idx` ON `paymentEvents` (`orderId`);