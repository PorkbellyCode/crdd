-- SQLite는 기본값 없는 NOT NULL 컬럼을 기존 테이블에 추가할 수 없다. 생성된 SQL에 DEFAULT ''를 손으로 더했다.
DROP INDEX `scores_user_project_community_idx`;--> statement-breakpoint
ALTER TABLE `scores` ADD `concept_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `scores_user_project_concept_idx` ON `scores` (`user_id`,`project_id`,`concept_key`);--> statement-breakpoint
ALTER TABLE `scores` DROP COLUMN `community_id`;--> statement-breakpoint
DROP INDEX `concepts_project_community_idx`;--> statement-breakpoint
ALTER TABLE `concepts` ADD `key` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- 기존 행은 임시 키를 받는다. 다음 재분석 때 파일 집합 유사도로 이 키를 그대로 이어받는다
UPDATE `concepts` SET `key` = 'c' || `community_id` || '-legacy';--> statement-breakpoint
ALTER TABLE `concepts` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `concepts_project_key_idx` ON `concepts` (`project_id`,`key`);--> statement-breakpoint
CREATE INDEX `concepts_project_community_idx` ON `concepts` (`project_id`,`community_id`);--> statement-breakpoint
ALTER TABLE `analyses` ADD `concept_keys_json` text;--> statement-breakpoint
ALTER TABLE `history` ADD `concept_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `history_user_concept_idx` ON `history` (`user_id`,`project_id`,`concept_key`);--> statement-breakpoint
ALTER TABLE `history` DROP COLUMN `community_id`;