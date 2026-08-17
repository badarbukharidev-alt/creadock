ALTER TABLE `orders` ADD `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stripe_checkout_session_idx` UNIQUE(`stripeCheckoutSessionId`);
