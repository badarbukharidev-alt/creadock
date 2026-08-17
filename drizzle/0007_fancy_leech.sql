ALTER TABLE `customers` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customers_user_idx` ON `customers` (`userId`);
