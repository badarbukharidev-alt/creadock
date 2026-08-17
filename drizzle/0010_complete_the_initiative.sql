ALTER TABLE `storefrontBlocks` MODIFY COLUMN `type` enum('profile','heading','text','button','social','product','productGrid','course','booking','image','video','gallery','divider','email','membership','faq','testimonial','countdown','embed','html') NOT NULL;--> statement-breakpoint
ALTER TABLE `creators` ADD `headline` varchar(220);--> statement-breakpoint
ALTER TABLE `creators` ADD `location` varchar(160);--> statement-breakpoint
ALTER TABLE `creators` ADD `logoUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `creators` ADD `coverUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `creators` ADD `visualSettings` json;