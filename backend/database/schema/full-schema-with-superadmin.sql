-- =====================================================================
-- AI-Driven Voucher Monitoring System: FULL database schema (MariaDB 10.4)
-- Rebuilt 2026-11-19 for re-creating the database after the XAMPP crash.
--
-- = mysql-schema.sql (official baseline) + the 6 migrations dated 2026_11_19_*
--   (backend/database/migrations/), all approved by the user on 2026-11-19:
--   000001  users.role also allows 'super_admin'                     (docx section 4)
--   000002  NEW table system_settings (Super Admin global settings)  (docx section 4.9)
--   000003  audit_logs.user_id / company_id may be NULL (system / platform-level rows);
--           deleting a user/company that has audit or approval history is REFUSED
--   000004  companies: suspended_at, suspended_by, suspension_reason;
--           companies/departments.is_active are 0/1, never NULL (default 1)
--   000005  voucher/payee type names and category codes are unique PER COMPANY
--   000006  voucher_categories.is_active is 0/1 instead of 'activated'/'notActivated'
-- Checked against docs/System_Flow_Roles_and_UML_Design.docx (ER + class diagrams).
--
-- The `migrations` rows at the bottom mark ALL migrations (including the 6 new ones)
-- as already run, so `php artisan migrate` will have nothing to do afterwards.
--
-- How to use it (phpMyAdmin "Import", or the mysql CLI):
--   1. Create the empty database (uncomment the 3 lines below, or do it in phpMyAdmin).
--   2. Import this file into it.
-- Structure only: no data. Refill demo data with `php artisan db:seed`.
-- =====================================================================

-- DROP DATABASE IF EXISTS `AI_Driven_Voucher_Monitoring_System_Database`;
-- CREATE DATABASE `AI_Driven_Voucher_Monitoring_System_Database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `AI_Driven_Voucher_Monitoring_System_Database`;

/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `ai_forecasts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_forecasts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `department_id` bigint(20) unsigned NOT NULL,
  `forecast_for_month` date NOT NULL COMMENT 'The month being predicted (first day of month)',
  `predicted_spend` decimal(15,2) NOT NULL COMMENT 'AI-predicted total spending',
  `confidence_score` decimal(5,4) NOT NULL,
  `model_version` varchar(255) NOT NULL COMMENT 'Version of the AI model used for prediction',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ai_forecasts_company_id_foreign` (`company_id`),
  KEY `ai_forecasts_department_id_foreign` (`department_id`),
  CONSTRAINT `ai_forecasts_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_forecasts_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL COMMENT 'NULL = done by the system',
  `company_id` bigint(20) unsigned DEFAULT NULL COMMENT 'NULL = platform-level action (no company)',
  `action` varchar(255) NOT NULL,
  `table_name` varchar(255) NOT NULL,
  `record_id` bigint(20) unsigned DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_company_id_foreign` (`company_id`),
  CONSTRAINT `audit_logs_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `budget_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `budget_allocations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `department_id` bigint(20) unsigned NOT NULL,
  `fiscal_year` year(4) NOT NULL COMMENT 'Fiscal year for which the budget allocation is made. Fiscal year, e.g., 2025',
  `fiscal_month` tinyint(4) NOT NULL COMMENT 'Fiscal month for which the budget allocation is made. Fiscal month, e.g., 1 for January, 2 for February, etc.',
  `total_budget` decimal(15,2) NOT NULL COMMENT 'Total budget allocated for the specified fiscal year and month',
  `used_amount` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount of the budget that has been used or spent',
  `alert_threshold_pct` decimal(5,2) NOT NULL DEFAULT 80.00 COMMENT 'Percentage threshold for budget alert. When the used amount reaches this percentage of the total budget, an alert is triggered.',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `budget_allocations_company_id_foreign` (`company_id`),
  KEY `budget_allocations_department_id_foreign` (`department_id`),
  KEY `budget_allocations_created_by_foreign` (`created_by`),
  CONSTRAINT `budget_allocations_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_allocations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_allocations_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `companies` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` enum('school','corporate','government','ngo','other') NOT NULL,
  `address` text DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `logo` varchar(500) DEFAULT NULL,
  `fiscal_year_start` date DEFAULT NULL,
  `tin_number` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `suspended_at` timestamp NULL DEFAULT NULL COMMENT 'Set when a Super Admin suspends the company',
  `suspended_by` bigint(20) unsigned DEFAULT NULL,
  `suspension_reason` text DEFAULT NULL COMMENT 'Required when suspending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `companies_suspended_by_foreign` (`suspended_by`),
  CONSTRAINT `companies_suspended_by_foreign` FOREIGN KEY (`suspended_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `departments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `name` varchar(150) NOT NULL,
  `code` varchar(20) NOT NULL,
  `description` text DEFAULT NULL,
  `head_user_id` bigint(20) unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `departments_company_id_foreign` (`company_id`),
  KEY `departments_head_user_id_foreign` (`head_user_id`),
  CONSTRAINT `departments_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `departments_head_user_id_foreign` FOREIGN KEY (`head_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` varchar(255) NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `financial_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `financial_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `department_id` bigint(20) unsigned DEFAULT NULL,
  `report_type` enum('monthly','quarterly','annual','custom') NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `total_vouchers` int(11) NOT NULL DEFAULT 0,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `approved_count` int(11) NOT NULL DEFAULT 0,
  `rejected_count` int(11) NOT NULL DEFAULT 0,
  `anomalies_flag` int(11) NOT NULL DEFAULT 0,
  `ai_summary` text DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `generated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `financial_reports_company_id_foreign` (`company_id`),
  KEY `financial_reports_department_id_foreign` (`department_id`),
  KEY `financial_reports_generated_by_foreign` (`generated_by`),
  CONSTRAINT `financial_reports_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_reports_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `financial_reports_generated_by_foreign` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `model_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `model_has_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recipient_id` bigint(20) unsigned NOT NULL,
  `title` varchar(255) NOT NULL COMMENT 'voucher_approved, voucher_rejected, anomaly_flag, budget_alert, voucher_pending',
  `message` text NOT NULL COMMENT 'Detailed message for the notification',
  `voucher_id` bigint(20) unsigned DEFAULT NULL,
  `is_read` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0 = unread, 1 = read',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `type` enum('voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert','security_alert','access_changed','user_changed','department_alert','company_changed') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_recipient_id_foreign` (`recipient_id`),
  KEY `notifications_voucher_id_foreign` (`voucher_id`),
  CONSTRAINT `notifications_recipient_id_foreign` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_voucher_id_foreign` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `payee_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payee_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payee_types_company_id_name_unique` (`company_id`,`name`),
  KEY `payee_types_company_id_foreign` (`company_id`),
  KEY `payee_types_created_by_foreign` (`created_by`),
  CONSTRAINT `payee_types_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payee_types_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `role_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL COMMENT 'e.g. approval.high_value_threshold, ai.anomaly_sensitivity, openai.monthly_cap',
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON so numbers, booleans and text all fit' CHECK (json_valid(`value`)),
  `group` varchar(50) NOT NULL DEFAULT 'general' COMMENT 'approval, ai, openai, security, backups (the Global settings sections)',
  `description` varchar(255) DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL COMMENT 'Super Admin who last changed it',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_key_unique` (`key`),
  KEY `system_settings_group_index` (`group`),
  KEY `system_settings_updated_by_foreign` (`updated_by`),
  CONSTRAINT `system_settings_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `telescope_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_entries` (
  `sequence` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `batch_id` char(36) NOT NULL,
  `family_hash` varchar(255) DEFAULT NULL,
  `should_display_on_index` tinyint(1) NOT NULL DEFAULT 1,
  `type` varchar(20) NOT NULL,
  `content` longtext NOT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`sequence`),
  UNIQUE KEY `telescope_entries_uuid_unique` (`uuid`),
  KEY `telescope_entries_batch_id_index` (`batch_id`),
  KEY `telescope_entries_family_hash_index` (`family_hash`),
  KEY `telescope_entries_created_at_index` (`created_at`),
  KEY `telescope_entries_type_should_display_on_index_index` (`type`,`should_display_on_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `telescope_entries_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_entries_tags` (
  `entry_uuid` char(36) NOT NULL,
  `tag` varchar(255) NOT NULL,
  PRIMARY KEY (`entry_uuid`,`tag`),
  KEY `telescope_entries_tags_tag_index` (`tag`),
  CONSTRAINT `telescope_entries_tags_entry_uuid_foreign` FOREIGN KEY (`entry_uuid`) REFERENCES `telescope_entries` (`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `telescope_monitoring`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_monitoring` (
  `tag` varchar(255) NOT NULL,
  PRIMARY KEY (`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_company_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_company_access` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `company_id` bigint(20) unsigned NOT NULL,
  `granted_status` enum('pending','accepted','denied') NOT NULL DEFAULT 'pending',
  `granted_by` bigint(20) unsigned DEFAULT NULL,
  `granted_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_company_access_user_id_foreign` (`user_id`),
  KEY `user_company_access_company_id_foreign` (`company_id`),
  KEY `user_company_access_granted_by_foreign` (`granted_by`),
  CONSTRAINT `user_company_access_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `user_company_access_granted_by_foreign` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_company_access_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT 0,
  `access_status` enum('accepted','pending','rejected') NOT NULL DEFAULT 'pending',
  `role` enum('super_admin','admin','accounting_clerk','accounting_officer','supervisor_manager') NOT NULL,
  `department_id` bigint(20) unsigned DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `profile_photo` varchar(500) DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT current_timestamp(),
  `deactivated_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_employee_id_unique` (`employee_id`),
  KEY `users_department_id_foreign` (`department_id`),
  KEY `users_company_id_foreign` (`company_id`),
  CONSTRAINT `users_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `voucher_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_approvals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_id` bigint(20) unsigned NOT NULL,
  `approver_id` bigint(20) unsigned DEFAULT NULL,
  `step` tinyint(4) NOT NULL DEFAULT 1 COMMENT 'Step of the approval process, 1 = accounting, 2 = supervisor_manager',
  `role_at_time` enum('accounting_officer','supervisor_manager') NOT NULL DEFAULT 'accounting_officer',
  `action` enum('approved','rejected','returned','noted') NOT NULL,
  `remarks` text DEFAULT NULL COMMENT 'Remarks provided by the approver during the approval process',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `voucher_approvals_voucher_id_foreign` (`voucher_id`),
  KEY `voucher_approvals_approver_id_foreign` (`approver_id`),
  CONSTRAINT `voucher_approvals_approver_id_foreign` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `voucher_approvals_voucher_id_foreign` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `voucher_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_attachments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_id` bigint(20) unsigned NOT NULL,
  `uploaded_by` bigint(20) unsigned DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(255) NOT NULL,
  `file_size_kb` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `voucher_attachments_voucher_id_foreign` (`voucher_id`),
  KEY `voucher_attachments_uploaded_by_foreign` (`uploaded_by`),
  CONSTRAINT `voucher_attachments_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `voucher_attachments_voucher_id_foreign` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `voucher_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(20) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voucher_categories_company_id_code_unique` (`company_id`,`code`),
  KEY `voucher_categories_company_id_foreign` (`company_id`),
  CONSTRAINT `voucher_categories_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `voucher_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_line_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_id` bigint(20) unsigned NOT NULL,
  `description` text DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit` varchar(255) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `voucher_line_items_voucher_id_foreign` (`voucher_id`),
  CONSTRAINT `voucher_line_items_voucher_id_foreign` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `voucher_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_types` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voucher_types_company_id_name_unique` (`company_id`,`name`),
  KEY `voucher_types_company_id_foreign` (`company_id`),
  KEY `voucher_types_created_by_foreign` (`created_by`),
  CONSTRAINT `voucher_types_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `voucher_types_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vouchers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_number` varchar(255) NOT NULL,
  `voucher_type_id` bigint(20) unsigned DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `department_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `payee_name` varchar(255) DEFAULT NULL,
  `payee_type_id` bigint(20) unsigned DEFAULT NULL,
  `payee_employee_id` varchar(255) DEFAULT NULL,
  `payee_position` varchar(255) DEFAULT NULL COMMENT 'Position of the payee in the organization',
  `payee_department_id` bigint(20) unsigned DEFAULT NULL,
  `payment_method` enum('cash','bank','cheque') NOT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `bank_account_number` varchar(255) DEFAULT NULL,
  `bank_account_name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `purpose` text DEFAULT NULL,
  `category_id` bigint(20) unsigned NOT NULL,
  `reference_number` varchar(255) DEFAULT NULL,
  `period_start` date DEFAULT NULL COMMENT 'Start date of the period for which the voucher is issued',
  `period_end` date DEFAULT NULL COMMENT 'End date of the period for which the voucher is issued',
  `due_date` date DEFAULT NULL COMMENT 'Due date for payment of the voucher',
  `priority` enum('low','urgent','normal','high') NOT NULL DEFAULT 'normal' COMMENT 'Priority level of the voucher',
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Total amount of the voucher',
  `currency` varchar(255) NOT NULL DEFAULT 'PHP' COMMENT 'Currency of the voucher amount',
  `amount_in_words` text DEFAULT NULL COMMENT 'Amount in words for the voucher',
  `status` enum('draft','pending','under_review','approved','rejected','cancelled') NOT NULL,
  `ai_category_suggestion` varchar(255) DEFAULT NULL COMMENT 'AI-generated category suggestion for the voucher',
  `ai_category_confidence` decimal(5,2) DEFAULT NULL COMMENT 'Confidence level of the AI-generated category suggestion',
  `ai_anomaly_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT 'Flag indicating if the voucher is flagged as an anomaly by the AI',
  `ai_anomaly_score` decimal(5,2) DEFAULT NULL COMMENT 'Anomaly score assigned by the AI to the voucher',
  `ai_anomaly_reason` text DEFAULT NULL COMMENT 'Reason provided by the AI for flagging the voucher as an anomaly',
  `submitted_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when the voucher was submitted for approval',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when the voucher was approved',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vouchers_voucher_number_unique` (`voucher_number`),
  KEY `vouchers_voucher_type_id_foreign` (`voucher_type_id`),
  KEY `vouchers_company_id_foreign` (`company_id`),
  KEY `vouchers_department_id_foreign` (`department_id`),
  KEY `vouchers_created_by_foreign` (`created_by`),
  KEY `vouchers_payee_type_id_foreign` (`payee_type_id`),
  KEY `vouchers_payee_department_id_foreign` (`payee_department_id`),
  KEY `vouchers_category_id_foreign` (`category_id`),
  CONSTRAINT `vouchers_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `voucher_categories` (`id`),
  CONSTRAINT `vouchers_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_payee_department_id_foreign` FOREIGN KEY (`payee_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_payee_type_id_foreign` FOREIGN KEY (`payee_type_id`) REFERENCES `payee_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_voucher_type_id_foreign` FOREIGN KEY (`voucher_type_id`) REFERENCES `voucher_types` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (5,'0001_01_01_000000_create_users_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (6,'0001_01_01_000001_create_cache_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (7,'0001_01_01_000002_create_jobs_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (8,'2026_06_30_110403_create_companies_table',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (11,'2026_06_30_111746_create_departments_table',2);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (12,'2026_06_30_113739_add_employee_columns_to_users_table',3);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (13,'2026_06_30_131818_create_user_company_access_table',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (16,'2026_06_30_144332_create_user_company_access_table',5);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (17,'2026_06_30_144518_create_voucher_categories_table',6);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (18,'2026_07_03_135653_create_personal_access_tokens_table',7);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (19,'2026_07_03_162318_create_telescope_entries_table',8);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (20,'2026_07_03_172231_create_permission_tables',9);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (22,'2026_07_06_085100_create_voucher_types_table',10);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (23,'2026_07_06_093409_create_payee_types_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (24,'2026_07_07_035349_create_vouchers_table',12);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (25,'2026_07_08_072804_create_voucher_line_items_table',13);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (26,'2026_07_08_141745_create_voucher_attachments_table',14);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (27,'2026_07_08_144429_create_voucher_approvals_table',15);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (28,'2026_07_08_204402_create_budget_allocations_table',16);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (29,'2026_07_08_212328_create_notifications_table',17);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (30,'2026_07_08_213033_create_ai_forecasts_table',18);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (31,'2026_07_08_213951_create_financial_reports_table',19);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (32,'2026_07_08_215211_create_audit_logs_table',20);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (33,'2026_11_06_073244_change_is_active_to_tiny_integer_in_users_table',21);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (34,'2026_11_06_074013_drop_email_is_verified_at_in_users_table',22);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (35,'2026_11_06_075525_add_payee_position_column_in_vouchers_table',23);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (36,'2026_11_06_075915_drop_position_column_in_users_table',24);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (37,'2026_11_06_080406_change_ammount_in_words_typos_in_vouchers_table',25);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (38,'2026_11_06_080707_add_amount_in_words_in_vouchers_table',26);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (39,'2026_11_06_082349_drop_step_in_voucher_approvals_table_to_change_into_tiny_integer',27);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (40,'2026_11_06_082543_add_updated_step_type_in_voucher_approvals_table',28);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (41,'2026_11_06_082913_drop_role_at_time_to_change_enum_values_in_voucher_approvals_table',29);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (42,'2026_11_06_083103_add_updated_role_at_time_column_in_voucher_approvals_table',30);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (43,'2026_11_06_084209_add_type_column_in_notifications_table',31);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (44,'2026_11_14_111734_edit_role_at_time_type_enum_values_in_voucher_approvals_table',32);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (45,'2026_11_14_111920_add_the_updated_version_of_role_at_time_enum_values_in_voucher_approvals_table',33);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (46,'2026_11_14_130931_drop_name_column_on_users_table',34);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (47,'2026_11_16_000001_add_admin_types_to_notifications_type',35);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (48,'2026_11_16_000002_add_unique_index_to_users_employee_id',36);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (49,'2026_11_19_000001_add_super_admin_to_users_role',37);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (50,'2026_11_19_000002_create_system_settings_table',37);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (51,'2026_11_19_000003_protect_audit_and_approval_history',37);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (52,'2026_11_19_000004_add_suspension_to_companies_and_fix_is_active',37);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (53,'2026_11_19_000005_make_catalog_names_unique_per_company',37);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (54,'2026_11_19_000006_change_voucher_categories_is_active_to_boolean',37);
