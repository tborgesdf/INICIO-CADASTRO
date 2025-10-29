-- Add status and updated_at to users
ALTER TABLE `users`
  ADD COLUMN `status` ENUM('in_progress','submitted','completed') NOT NULL DEFAULT 'in_progress' AFTER `visa_type`,
  ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

