CREATE TABLE `bundleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` int NOT NULL,
	`productId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `bundleItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_items_bundle_product_idx` UNIQUE(`bundleId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`type` enum('percent','fixed') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`minimumAmount` decimal(10,2),
	`maxRedemptions` int,
	`redemptions` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_creator_code_idx` UNIQUE(`creatorId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `productBundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`compareAtPrice` decimal(10,2),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productBundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_bundles_creator_slug_idx` UNIQUE(`creatorId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `productVariants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`priceDelta` decimal(10,2) NOT NULL DEFAULT '0.00',
	`inventoryLimit` int,
	`inventorySold` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productVariants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `heroAssetId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `shortDescription` varchar(420);--> statement-breakpoint
ALTER TABLE `products` ADD `benefits` json;--> statement-breakpoint
ALTER TABLE `products` ADD `productPageSettings` json;--> statement-breakpoint
ALTER TABLE `products` ADD `visibility` enum('public','unlisted','private') DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `fulfillmentType` enum('digital','redirect','manual','none') DEFAULT 'digital' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `inventoryLimit` int;--> statement-breakpoint
ALTER TABLE `products` ADD `inventorySold` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bundleItems` ADD CONSTRAINT `bundleItems_bundleId_productBundles_id_fk` FOREIGN KEY (`bundleId`) REFERENCES `productBundles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundleItems` ADD CONSTRAINT `bundleItems_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productBundles` ADD CONSTRAINT `productBundles_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productVariants` ADD CONSTRAINT `productVariants_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bundle_items_bundle_idx` ON `bundleItems` (`bundleId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `coupons_creator_active_idx` ON `coupons` (`creatorId`,`isActive`);--> statement-breakpoint
CREATE INDEX `product_bundles_creator_status_idx` ON `productBundles` (`creatorId`,`status`);--> statement-breakpoint
CREATE INDEX `product_variants_product_idx` ON `productVariants` (`productId`,`sortOrder`);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_heroAssetId_mediaAssets_id_fk` FOREIGN KEY (`heroAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;