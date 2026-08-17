ALTER TABLE `enrollments` MODIFY COLUMN `completedLessonIds` json NOT NULL;--> statement-breakpoint
ALTER TABLE `membershipPlans` MODIFY COLUMN `benefits` json NOT NULL;