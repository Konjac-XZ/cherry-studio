CREATE TABLE `translate_glossary` (
	`id` text PRIMARY KEY NOT NULL,
	`source_phrase` text NOT NULL,
	`target_phrase` text NOT NULL,
	`target_language` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`target_language`) REFERENCES `translate_language`(`lang_code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `translate_glossary_target_language_idx` ON `translate_glossary` (`target_language`,`created_at`);--> statement-breakpoint
ALTER TABLE `translate_history` ADD `model_id` text;--> statement-breakpoint
ALTER TABLE `translate_history` ADD `cache_key` text;--> statement-breakpoint
CREATE INDEX `translate_history_cache_key_idx` ON `translate_history` (`cache_key`);--> statement-breakpoint
CREATE INDEX `translate_history_model_id_idx` ON `translate_history` (`model_id`);