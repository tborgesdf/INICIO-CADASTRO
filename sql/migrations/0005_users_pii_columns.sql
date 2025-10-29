-- Add encrypted PII columns and blind indexes for users
ALTER TABLE `users`
  ADD COLUMN `cpf_enc` TEXT NULL AFTER `email`,
  ADD COLUMN `phone_enc` TEXT NULL AFTER `cpf_enc`,
  ADD COLUMN `email_enc` TEXT NULL AFTER `phone_enc`,
  ADD COLUMN `cpf_bidx` CHAR(64) NULL AFTER `email_enc`,
  ADD COLUMN `email_bidx` CHAR(64) NULL AFTER `cpf_bidx`;

-- Optional hardening: enforce CPF uniqueness by blind index
ALTER TABLE `users`
  ADD UNIQUE KEY `uq_users_cpf_bidx` (`cpf_bidx`),
  ADD KEY `idx_users_email_bidx` (`email_bidx`);

