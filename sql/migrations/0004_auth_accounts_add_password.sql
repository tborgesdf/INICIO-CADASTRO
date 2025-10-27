-- Add password hash for email/password accounts
ALTER TABLE `auth_accounts`
  ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `name`;

