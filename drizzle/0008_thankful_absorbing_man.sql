CREATE TABLE `platformSettings` (
	`id` int NOT NULL,
	`platformName` varchar(120) NOT NULL DEFAULT 'CreaDock',
	`supportEmail` varchar(320),
	`allowPublicSignups` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `fileSizeBytes` int unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `platformSettings` ADD CONSTRAINT `platformSettings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;