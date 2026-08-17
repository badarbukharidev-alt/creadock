CREATE TABLE `courseModules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`imageAssetId` int,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`isVisible` boolean NOT NULL DEFAULT true,
	`dripDays` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courseModules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessonQuizAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int NOT NULL,
	`lessonId` int NOT NULL,
	`selectedAnswerIndex` int NOT NULL,
	`score` int NOT NULL,
	`isPassed` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lessonQuizAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lessons` MODIFY COLUMN `kind` enum('text','video','audio','image','download','quiz') NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE `courses` ADD `thumbnailAssetId` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `coverAssetId` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `learningOutcomes` json;--> statement-breakpoint
ALTER TABLE `courses` ADD `settings` json;--> statement-breakpoint
ALTER TABLE `lessons` ADD `moduleId` int;--> statement-breakpoint
ALTER TABLE `lessons` ADD `mediaAssetId` int;--> statement-breakpoint
ALTER TABLE `lessons` ADD `thumbnailAssetId` int;--> statement-breakpoint
ALTER TABLE `lessons` ADD `galleryAssetIds` json;--> statement-breakpoint
ALTER TABLE `lessons` ADD `resourceAssetIds` json;--> statement-breakpoint
ALTER TABLE `lessons` ADD `durationSeconds` int;--> statement-breakpoint
ALTER TABLE `lessons` ADD `quiz` json;--> statement-breakpoint
ALTER TABLE `lessons` ADD `isPublished` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `isLocked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `dripDays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `prerequisiteLessonId` int;--> statement-breakpoint
ALTER TABLE `courseModules` ADD CONSTRAINT `courseModules_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courseModules` ADD CONSTRAINT `courseModules_imageAssetId_mediaAssets_id_fk` FOREIGN KEY (`imageAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonQuizAttempts` ADD CONSTRAINT `lessonQuizAttempts_enrollmentId_enrollments_id_fk` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonQuizAttempts` ADD CONSTRAINT `lessonQuizAttempts_lessonId_lessons_id_fk` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `course_modules_course_idx` ON `courseModules` (`courseId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `lesson_quiz_attempts_enrollment_idx` ON `lessonQuizAttempts` (`enrollmentId`,`lessonId`);--> statement-breakpoint
CREATE INDEX `lesson_quiz_attempts_lesson_idx` ON `lessonQuizAttempts` (`lessonId`);--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_thumbnailAssetId_mediaAssets_id_fk` FOREIGN KEY (`thumbnailAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_coverAssetId_mediaAssets_id_fk` FOREIGN KEY (`coverAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_moduleId_courseModules_id_fk` FOREIGN KEY (`moduleId`) REFERENCES `courseModules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_mediaAssetId_mediaAssets_id_fk` FOREIGN KEY (`mediaAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_thumbnailAssetId_mediaAssets_id_fk` FOREIGN KEY (`thumbnailAssetId`) REFERENCES `mediaAssets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_prerequisiteLessonId_lessons_id_fk` FOREIGN KEY (`prerequisiteLessonId`) REFERENCES `lessons`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lessons_module_idx` ON `lessons` (`moduleId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `lessons_prerequisite_idx` ON `lessons` (`prerequisiteLessonId`);