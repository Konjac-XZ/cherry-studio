ALTER TABLE `translate_history` ADD `model_id` text;--> statement-breakpoint
ALTER TABLE `translate_history` ADD `cache_key` text;--> statement-breakpoint
CREATE INDEX `translate_history_cache_key_idx` ON `translate_history` (`cache_key`);--> statement-breakpoint
CREATE INDEX `translate_history_model_id_idx` ON `translate_history` (`model_id`);