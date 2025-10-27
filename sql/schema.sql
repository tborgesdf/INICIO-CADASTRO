-- NOTE: There is a mismatch in the request between
-- user name "deltafox_Federal_Express" and DB name "detalfox_Federal_Express".
-- The statements below use the DB name exactly as provided: detalfox_Federal_Express.

CREATE DATABASE IF NOT EXISTS `deltafox_visto` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `deltafox_visto`;

-- Main users table
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

-- Social media key-value per user
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

-- Selected countries per user
CREATE TABLE IF NOT EXISTS `user_countries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `country` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uc_user` (`user_id`),
  CONSTRAINT `fk_uc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
