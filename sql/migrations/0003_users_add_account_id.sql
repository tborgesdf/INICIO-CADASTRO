-- Link user intake to an authenticated account
ALTER TABLE `users`
  ADD COLUMN `account_id` BIGINT UNSIGNED NULL AFTER `id`,
  ADD KEY `idx_users_account` (`account_id`),
  ADD CONSTRAINT `fk_users_account` FOREIGN KEY (`account_id`) REFERENCES `auth_accounts`(`id`) ON DELETE SET NULL;

