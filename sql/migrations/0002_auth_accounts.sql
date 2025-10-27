-- Auth accounts to record social/email logins
CREATE TABLE IF NOT EXISTS `auth_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `provider` ENUM('google','apple','email') NOT NULL,
  `name` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_email_provider` (`email`,`provider`)
) ENGINE=InnoDB;

