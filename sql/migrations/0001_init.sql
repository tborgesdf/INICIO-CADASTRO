-- Initial schema (idempotent)
-- Creates core tables if they do not exist

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cpf` VARCHAR(32) NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `visa_type` ENUM('renewal','first_visa') NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_users_email` (`email`)
);

CREATE TABLE IF NOT EXISTS `user_social_media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `platform` VARCHAR(64) NOT NULL,
  `handle` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usm_user` (`user_id`),
  CONSTRAINT `fk_usm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `user_countries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `country` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uc_user` (`user_id`),
  CONSTRAINT `fk_uc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

