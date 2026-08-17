CREATE TABLE `creatorLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`pageId` int,
	`title` varchar(180) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`description` varchar(320),
	`icon` varchar(80),
	`thumbnailAssetId` int,
	`openInNewTab` boolean NOT NULL DEFAULT true,
	`isVisible` boolean NOT NULL DEFAULT true,
	`publishedAt` timestamp,
	`expiresAt` timestamp,
	`clickCount` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creatorLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creatorPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`kind` enum('home','links','about','products','services','courses','contact','custom') NOT NULL DEFAULT 'custom',
	`template` enum('creator','coach','consultant','educator','artist','agency','products','newsletter') NOT NULL DEFAULT 'creator',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`seoTitle` varchar(180),
	`seoDescription` varchar(320),
	`socialImageAssetId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creatorPages_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_pages_creator_slug_idx` UNIQUE(`creatorId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `mediaAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`folderId` int,
	`name` varchar(255) NOT NULL,
	`fileKey` varchar(1024) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`kind` enum('image','video','audio','document','archive','other') NOT NULL DEFAULT 'other',
	`sizeBytes` int NOT NULL DEFAULT 0,
	`width` int,
	`height` int,
	`durationSeconds` int,
	`altText` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mediaAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mediaFolders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`parentId` int,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mediaFolders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pageBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` int NOT NULL,
	`type` enum('profile','heading','text','link','product','productGrid','course','booking','membership','social','image','video','gallery','divider','email','faq','countdown','embed','html') NOT NULL,
	`content` json NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pageBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `creatorLinks` ADD CONSTRAINT `creatorLinks_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creatorLinks` ADD CONSTRAINT `creatorLinks_pageId_creatorPages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `creatorPages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creatorLinks` ADD CONSTRAINT `creatorLinks_thumbnailAssetId_mediaAssets_id_fk` FOREIGN KEY (`thumbnailAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creatorPages` ADD CONSTRAINT `creatorPages_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creatorPages` ADD CONSTRAINT `creatorPages_socialImageAssetId_mediaAssets_id_fk` FOREIGN KEY (`socialImageAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mediaAssets` ADD CONSTRAINT `mediaAssets_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mediaAssets` ADD CONSTRAINT `mediaAssets_folderId_mediaFolders_id_fk` FOREIGN KEY (`folderId`) REFERENCES `mediaFolders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mediaFolders` ADD CONSTRAINT `mediaFolders_creatorId_creators_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `creators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pageBlocks` ADD CONSTRAINT `pageBlocks_pageId_creatorPages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `creatorPages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `creator_links_creator_idx` ON `creatorLinks` (`creatorId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `creator_links_page_idx` ON `creatorLinks` (`pageId`);--> statement-breakpoint
CREATE INDEX `creator_pages_creator_status_idx` ON `creatorPages` (`creatorId`,`status`);--> statement-breakpoint
CREATE INDEX `media_assets_creator_idx` ON `mediaAssets` (`creatorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `media_assets_folder_idx` ON `mediaAssets` (`folderId`);--> statement-breakpoint
CREATE INDEX `media_assets_kind_idx` ON `mediaAssets` (`creatorId`,`kind`);--> statement-breakpoint
CREATE INDEX `media_folders_creator_idx` ON `mediaFolders` (`creatorId`);--> statement-breakpoint
CREATE INDEX `media_folders_parent_idx` ON `mediaFolders` (`parentId`);--> statement-breakpoint
CREATE INDEX `page_blocks_page_idx` ON `pageBlocks` (`pageId`,`sortOrder`);