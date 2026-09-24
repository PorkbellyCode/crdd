CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`analysis_id` text NOT NULL,
	`concept_key` text NOT NULL,
	`concept_name` text NOT NULL,
	`commit` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`questions_json` text NOT NULL,
	`progress_json` text NOT NULL,
	`result_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quizzes_user_project_idx` ON `quizzes` (`user_id`,`project_id`);