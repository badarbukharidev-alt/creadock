ALTER TABLE `enrollments` ADD `membershipPlanId` int;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_membershipPlanId_membershipPlans_id_fk` FOREIGN KEY (`membershipPlanId`) REFERENCES `membershipPlans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `enrollments_membership_plan_idx` ON `enrollments` (`membershipPlanId`);