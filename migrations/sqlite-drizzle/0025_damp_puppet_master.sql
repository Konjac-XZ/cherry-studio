CREATE TABLE IF NOT EXISTS `translate_glossary` (
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
CREATE INDEX IF NOT EXISTS `translate_glossary_target_language_idx` ON `translate_glossary` (`target_language`,`created_at`);
--> statement-breakpoint
UPDATE `user_model` SET `group` = NULL WHERE trim(`group`) = trim(`provider_id`);
