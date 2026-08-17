CREATE TABLE `digitalEntitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`productId` int NOT NULL,
	`orderId` int NOT NULL,
	`deliveryUrl` varchar(1024),
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digitalEntitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `digital_entitlements_customer_product_idx` UNIQUE(`customerId`,`productId`)
);
--> statement-breakpoint
ALTER TABLE `digitalEntitlements` ADD CONSTRAINT `digitalEntitlements_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `digitalEntitlements` ADD CONSTRAINT `digitalEntitlements_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `digitalEntitlements` ADD CONSTRAINT `digitalEntitlements_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `digital_entitlements_order_idx` ON `digitalEntitlements` (`orderId`);