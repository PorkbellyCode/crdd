CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`commit` text NOT NULL,
	`map_json` text NOT NULL,
	`file_hashes_json` text NOT NULL,
	`node_count` integer NOT NULL,
	`edge_count` integer NOT NULL,
	`concept_count` integer NOT NULL,
	`timings_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analyses_project_idx` ON `analyses` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_project_commit_idx` ON `analyses` (`project_id`,`commit`);--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`community_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_rule` text,
	`name_source` text DEFAULT 'auto' NOT NULL,
	`files_json` text NOT NULL,
	`node_count` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `concepts_project_community_idx` ON `concepts` (`project_id`,`community_id`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`project_id` text NOT NULL,
	`community_id` integer NOT NULL,
	`commit` text NOT NULL,
	`correct` real NOT NULL,
	`total` integer NOT NULL,
	`score_before` integer NOT NULL,
	`score_after` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_user_project_idx` ON `history` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`step` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`project_id` text,
	`analysis_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`root_commit` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_repo_idx` ON `projects` (`repo`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`project_id` text NOT NULL,
	`community_id` integer NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`last_verified_commit` text,
	`last_quiz_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_user_project_community_idx` ON `scores` (`user_id`,`project_id`,`community_id`);