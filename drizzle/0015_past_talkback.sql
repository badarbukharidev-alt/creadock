ALTER TABLE `appointments` ADD `reminderAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD `reminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD `reminderScheduleTaskUid` varchar(65);--> statement-breakpoint
CREATE INDEX `appointments_reminder_task_idx` ON `appointments` (`reminderScheduleTaskUid`);