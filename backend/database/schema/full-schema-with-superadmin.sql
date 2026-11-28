-- =====================================================================
-- AI-Driven Voucher Monitoring System: FULL database schema (MariaDB 10.4)
-- First built 2026-11-19 for re-creating the database after the XAMPP crash.
-- Refreshed 2026-11-28 from the live database (`php artisan schema:dump`), so it is
-- the same as mysql-schema.sql plus this header and the commented CREATE DATABASE lines.
--
-- Migrations included on top of the original baseline:
--   2026_11_19_000001  users.role also allows 'super_admin'                     (docx section 4)
--   2026_11_19_000002  NEW table system_settings (Super Admin global settings)  (docx section 4.9)
--   2026_11_19_000003  audit_logs.user_id / company_id may be NULL (system / platform-level rows);
--                      deleting a user/company that has audit or approval history is REFUSED
--   2026_11_19_000004  companies: suspended_at, suspended_by, suspension_reason;
--                      companies/departments.is_active are 0/1, never NULL (default 1)
--   2026_11_19_000005  voucher/payee type names and category codes are unique PER COMPANY
--   2026_11_19_000006  voucher_categories.is_active is 0/1 instead of 'activated'/'notActivated'
--   2026_11_19_174142  users.deactivated_at
--   2026_11_20_000001  users.last_login_at has no default (NULL until the first sign-in)
--   2026_11_20_000002  users.personal_email (where invitation / reset links are sent)
--   2026_11_20_000003  NEW table security_alerts (Security alerts panel, shared by Super Admins)
--   2026_11_21_000001  NEW table backups (database backup runs); notifications.type also allows 'system_alert'
--   2026_11_21_000002 … 2026_11_28_000003  (19 more: two-step sign-in, audit fingerprints, blocked IPs,
--                      health checks, payees, budgets, reports, forecasts, company map pin, payee email, …)
-- Checked against docs/System_Flow_Roles_and_UML_Design.docx (ER + class diagrams).
--
-- The `migrations` rows at the bottom mark ALL migrations as already run,
-- so `php artisan migrate` will have nothing to do afterwards.
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
  `department_id` bigint(20) unsigned DEFAULT NULL COMMENT 'Empty = the whole company',
  `forecast_for_month` date NOT NULL COMMENT 'The month being predicted (first day of month)',
  `predicted_spend` decimal(15,2) NOT NULL COMMENT 'AI-predicted total spending',
  `lower_bound` decimal(15,2) NOT NULL DEFAULT 0.00,
  `upper_bound` decimal(15,2) NOT NULL DEFAULT 0.00,
  `confidence_score` decimal(5,4) NOT NULL,
  `r_squared` decimal(5,4) DEFAULT NULL COMMENT 'How well the trend line fits, 0–1',
  `months_used` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `method` varchar(30) NOT NULL DEFAULT 'linear_trend' COMMENT 'linear_trend (Laravel) | model (Phase 5 ML service)',
  `model_version` varchar(255) NOT NULL COMMENT 'Version of the AI model used for prediction',
  `generated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ai_forecasts_company_department_month_unique` (`company_id`,`department_id`,`forecast_for_month`),
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
  `request_id` varchar(64) DEFAULT NULL COMMENT 'AssignRequestId: groups the entries of one request',
  `hash` char(64) DEFAULT NULL COMMENT 'HMAC-SHA256 fingerprint; NULL = written before fingerprints',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_company_id_foreign` (`company_id`),
  KEY `audit_logs_created_at_index` (`created_at`),
  KEY `audit_logs_action_created_at_index` (`action`,`created_at`),
  KEY `audit_logs_ip_address_index` (`ip_address`),
  KEY `audit_logs_table_name_record_id_index` (`table_name`,`record_id`),
  KEY `audit_logs_request_id_index` (`request_id`),
  CONSTRAINT `audit_logs_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backups` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `status` enum('queued','running','succeeded','failed') NOT NULL DEFAULT 'queued',
  `trigger` enum('scheduled','manual') NOT NULL,
  `requested_by` bigint(20) unsigned DEFAULT NULL,
  `notify_requester` tinyint(1) NOT NULL DEFAULT 0 COMMENT '"Notify me when it finishes"',
  `file_path` varchar(255) DEFAULT NULL COMMENT 'Inside storage/app/private, never reachable from the web',
  `size_bytes` bigint(20) unsigned DEFAULT NULL COMMENT 'Size of the compressed file',
  `database_size_bytes` bigint(20) unsigned DEFAULT NULL COMMENT 'Size of the database when it started',
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `error` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `backups_requested_by_foreign` (`requested_by`),
  KEY `backups_status_finished_at_index` (`status`,`finished_at`),
  CONSTRAINT `backups_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `blocked_ips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blocked_ips` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL COMMENT 'IPv4 or IPv6',
  `reason` text NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'NULL = until a Super Admin unblocks it',
  `blocked_by` bigint(20) unsigned DEFAULT NULL,
  `unblocked_at` timestamp NULL DEFAULT NULL,
  `unblocked_by` bigint(20) unsigned DEFAULT NULL,
  `watch_until` timestamp NULL DEFAULT NULL COMMENT 'After an unblock: 3 failed sign-ins before this time block it again',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `blocked_ips_blocked_by_foreign` (`blocked_by`),
  KEY `blocked_ips_unblocked_by_foreign` (`unblocked_by`),
  KEY `blocked_ips_ip_address_unblocked_at_expires_at_index` (`ip_address`,`unblocked_at`,`expires_at`),
  CONSTRAINT `blocked_ips_blocked_by_foreign` FOREIGN KEY (`blocked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `blocked_ips_unblocked_by_foreign` FOREIGN KEY (`unblocked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
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
  `fiscal_month` tinyint(4) DEFAULT NULL COMMENT 'Not used since 2026-11-27: budgets are yearly (left empty)',
  `total_budget` decimal(15,2) NOT NULL COMMENT 'Total budget allocated for the specified fiscal year and month',
  `used_amount` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount of the budget that has been used or spent',
  `alert_threshold_pct` decimal(5,2) NOT NULL DEFAULT 80.00 COMMENT 'Percentage threshold for budget alert. When the used amount reaches this percentage of the total budget, an alert is triggered.',
  `alert_sent_at` timestamp NULL DEFAULT NULL COMMENT 'When usage passed the alert %, empty while below it',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budget_allocations_department_year_unique` (`company_id`,`department_id`,`fiscal_year`),
  KEY `budget_allocations_company_id_foreign` (`company_id`),
  KEY `budget_allocations_department_id_foreign` (`department_id`),
  KEY `budget_allocations_created_by_foreign` (`created_by`),
  KEY `budget_allocations_updated_by_foreign` (`updated_by`),
  CONSTRAINT `budget_allocations_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_allocations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_allocations_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_allocations_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `budget_change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `budget_change_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `budget_allocation_id` bigint(20) unsigned NOT NULL,
  `current_budget` decimal(15,2) NOT NULL COMMENT 'The allocation when the request was made',
  `requested_budget` decimal(15,2) NOT NULL,
  `current_alert_pct` decimal(5,2) NOT NULL,
  `requested_alert_pct` decimal(5,2) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `status` enum('pending','approved','declined','cancelled') NOT NULL DEFAULT 'pending',
  `requested_by` bigint(20) unsigned DEFAULT NULL,
  `decided_by` bigint(20) unsigned DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `decision_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `budget_change_requests_requested_by_foreign` (`requested_by`),
  KEY `budget_change_requests_decided_by_foreign` (`decided_by`),
  KEY `budget_change_requests_budget_allocation_id_status_index` (`budget_allocation_id`,`status`),
  KEY `budget_change_requests_company_id_status_index` (`company_id`,`status`),
  CONSTRAINT `budget_change_requests_budget_allocation_id_foreign` FOREIGN KEY (`budget_allocation_id`) REFERENCES `budget_allocations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_change_requests_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_change_requests_decided_by_foreign` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_change_requests_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
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
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `place_id` varchar(255) DEFAULT NULL COMMENT 'OpenStreetMap place of the pin, e.g. way/123456',
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
  UNIQUE KEY `companies_name_unique` (`name`),
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
  `title` varchar(160) DEFAULT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `total_vouchers` int(11) NOT NULL DEFAULT 0,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `approved_count` int(11) NOT NULL DEFAULT 0,
  `rejected_count` int(11) NOT NULL DEFAULT 0,
  `anomalies_flag` int(11) NOT NULL DEFAULT 0,
  `figures` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'The numbers when the report was made (never recalculated)' CHECK (json_valid(`figures`)),
  `includes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`includes`)),
  `ai_summary` text DEFAULT NULL,
  `summary_status` enum('queued','writing','ready','failed','paused','not_set_up','off') NOT NULL DEFAULT 'off',
  `summary_highlights` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`summary_highlights`)),
  `summary_model` varchar(60) DEFAULT NULL,
  `summary_tokens` int(10) unsigned DEFAULT NULL,
  `summary_cost_usd` decimal(10,6) DEFAULT NULL,
  `summary_error` varchar(500) DEFAULT NULL,
  `summary_attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `summary_generated_at` timestamp NULL DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `generated_by` bigint(20) unsigned DEFAULT NULL,
  `is_scheduled` tinyint(1) NOT NULL DEFAULT 0,
  `generated_at` timestamp NULL DEFAULT NULL,
  `signoff_status` enum('not_needed','pending','signed','returned') NOT NULL DEFAULT 'not_needed' COMMENT 'Supervisor sign-off: company-wide monthly / quarterly reports only',
  `signed_by` bigint(20) unsigned DEFAULT NULL,
  `signed_at` timestamp NULL DEFAULT NULL,
  `signoff_comment` varchar(1000) DEFAULT NULL COMMENT 'Comments for the board',
  `signoff_checks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`signoff_checks`)),
  `returned_note` varchar(1000) DEFAULT NULL COMMENT 'Why it was sent back to Accounting',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `financial_reports_company_id_foreign` (`company_id`),
  KEY `financial_reports_department_id_foreign` (`department_id`),
  KEY `financial_reports_generated_by_foreign` (`generated_by`),
  KEY `financial_reports_company_period_index` (`company_id`,`period_start`),
  KEY `financial_reports_summary_generated_index` (`summary_generated_at`),
  KEY `financial_reports_signed_by_foreign` (`signed_by`),
  KEY `financial_reports_company_signoff_index` (`company_id`,`signoff_status`),
  CONSTRAINT `financial_reports_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_reports_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `financial_reports_generated_by_foreign` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `financial_reports_signed_by_foreign` FOREIGN KEY (`signed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `health_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `health_checks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(20) NOT NULL COMMENT 'web, database, queue, scheduler, ml, backup',
  `status` varchar(20) NOT NULL COMMENT 'ok | warning | danger | not_configured',
  `latency_ms` int(10) unsigned DEFAULT NULL COMMENT 'How long the check took to answer',
  `metrics` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'e.g. {"waiting":14,"failed":5} for the queue' CHECK (json_valid(`metrics`)),
  `checked_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `health_checks_service_checked_at_index` (`service`,`checked_at`),
  KEY `health_checks_checked_at_index` (`checked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `idempotency_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `key` varchar(100) NOT NULL,
  `method` varchar(10) NOT NULL,
  `path` varchar(255) NOT NULL,
  `request_hash` char(64) NOT NULL,
  `status_code` smallint(5) unsigned DEFAULT NULL COMMENT 'NULL while the first request is still running',
  `response_body` longtext DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_keys_user_key_unique` (`user_id`,`key`),
  KEY `idempotency_keys_expires_at_index` (`expires_at`),
  CONSTRAINT `idempotency_keys_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `incidents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(20) NOT NULL,
  `title` varchar(160) NOT NULL,
  `status` enum('open','watching','resolved') NOT NULL DEFAULT 'open',
  `severity` varchar(20) NOT NULL DEFAULT 'warning' COMMENT 'warning (slow) | danger (down)',
  `started_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `recovered_at` timestamp NULL DEFAULT NULL COMMENT 'When the checks came back healthy',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` bigint(20) unsigned DEFAULT NULL,
  `closing_note` text DEFAULT NULL,
  `timeline` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '[{at, text}] in order' CHECK (json_valid(`timeline`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `incidents_resolved_by_foreign` (`resolved_by`),
  KEY `incidents_service_status_index` (`service`,`status`),
  KEY `incidents_started_at_index` (`started_at`),
  CONSTRAINT `incidents_resolved_by_foreign` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
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
  `type` enum('voucher_approved','voucher_rejected','voucher_pending','anomaly_flagged','budget_alert','security_alert','access_changed','user_changed','department_alert','company_changed','system_alert','draft_expiry','support_request','voucher_returned','budget_change','report_ready','report_signoff') NOT NULL,
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
DROP TABLE IF EXISTS `payees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payees` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `payee_type_id` bigint(20) unsigned DEFAULT NULL,
  `tin` varchar(20) DEFAULT NULL COMMENT 'Philippine TIN, stored as 000-000-000-000',
  `default_payment_method` enum('cash','bank','cheque') DEFAULT NULL,
  `bank_name` varchar(150) DEFAULT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `bank_account_name` varchar(150) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `deactivated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payees_company_id_name_unique` (`company_id`,`name`),
  UNIQUE KEY `payees_company_id_tin_unique` (`company_id`,`tin`),
  KEY `payees_payee_type_id_foreign` (`payee_type_id`),
  KEY `payees_created_by_foreign` (`created_by`),
  KEY `payees_updated_by_foreign` (`updated_by`),
  KEY `payees_company_id_is_active_index` (`company_id`,`is_active`),
  CONSTRAINT `payees_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `payees_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payees_payee_type_id_foreign` FOREIGN KEY (`payee_type_id`) REFERENCES `payee_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payees_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
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
DROP TABLE IF EXISTS `security_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `security_alerts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(40) NOT NULL,
  `severity` enum('high','medium','low') NOT NULL,
  `status` enum('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `subject_email` varchar(255) NOT NULL COMMENT 'The email typed / the account email, kept even if the account is gone',
  `ip_address` varchar(45) DEFAULT NULL,
  `device` varchar(100) DEFAULT NULL COMMENT 'e.g. "Chrome on Windows"',
  `event_count` int(10) unsigned NOT NULL DEFAULT 1,
  `first_seen_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `security_alerts_user_id_foreign` (`user_id`),
  KEY `security_alerts_reviewed_by_foreign` (`reviewed_by`),
  KEY `security_alerts_status_created_at_index` (`status`,`created_at`),
  KEY `security_alerts_type_subject_email_status_index` (`type`,`subject_email`,`status`),
  CONSTRAINT `security_alerts_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `security_alerts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
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
  `kind` enum('grant','invite','request') NOT NULL DEFAULT 'grant' COMMENT 'grant = Admin gave it; invite = Admin asked the person; request = the person asked the Admin',
  `requested_by` bigint(20) unsigned DEFAULT NULL,
  `message` varchar(500) DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `responded_by` bigint(20) unsigned DEFAULT NULL,
  `granted_by` bigint(20) unsigned DEFAULT NULL,
  `granted_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_company_access_user_id_foreign` (`user_id`),
  KEY `user_company_access_company_id_foreign` (`company_id`),
  KEY `user_company_access_granted_by_foreign` (`granted_by`),
  KEY `user_company_access_requested_by_foreign` (`requested_by`),
  KEY `user_company_access_responded_by_foreign` (`responded_by`),
  KEY `user_company_access_company_id_granted_status_kind_index` (`company_id`,`granted_status`,`kind`),
  CONSTRAINT `user_company_access_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `user_company_access_granted_by_foreign` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_company_access_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_company_access_responded_by_foreign` FOREIGN KEY (`responded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
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
  `personal_email` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `two_factor_required_at` timestamp NULL DEFAULT NULL,
  `two_factor_setup_deadline` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT 0,
  `access_status` enum('accepted','pending','rejected') NOT NULL DEFAULT 'pending',
  `role` enum('super_admin','admin','accounting_clerk','accounting_officer','supervisor_manager') NOT NULL,
  `department_id` bigint(20) unsigned DEFAULT NULL,
  `company_id` bigint(20) unsigned DEFAULT NULL,
  `profile_photo` varchar(500) DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
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
  `needs_changes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Return: the parts the clerk must fix' CHECK (json_valid(`needs_changes`)),
  `reason` varchar(60) DEFAULT NULL COMMENT 'Reject: the reason picked by the reviewer',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `voucher_approvals_voucher_id_foreign` (`voucher_id`),
  KEY `voucher_approvals_approver_id_foreign` (`approver_id`),
  CONSTRAINT `voucher_approvals_approver_id_foreign` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`),
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
  `payee_email` varchar(255) DEFAULT NULL COMMENT 'Where "Email the payee" sends the approval + payment PDF',
  `payee_id` bigint(20) unsigned DEFAULT NULL,
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
  `status` enum('draft','pending','under_review','returned','approved','rejected','cancelled') NOT NULL,
  `ai_category_suggestion` varchar(255) DEFAULT NULL COMMENT 'AI-generated category suggestion for the voucher',
  `ai_category_confidence` decimal(5,2) DEFAULT NULL COMMENT 'Confidence level of the AI-generated category suggestion',
  `ai_anomaly_flag` tinyint(4) NOT NULL DEFAULT 0 COMMENT 'Flag indicating if the voucher is flagged as an anomaly by the AI',
  `ai_anomaly_score` decimal(5,2) DEFAULT NULL COMMENT 'Anomaly score assigned by the AI to the voucher',
  `ai_anomaly_reason` text DEFAULT NULL COMMENT 'Reason provided by the AI for flagging the voucher as an anomaly',
  `ai_check_signals` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ai_check_signals`)),
  `ai_check_source` varchar(20) DEFAULT NULL,
  `ai_checked_at` timestamp NULL DEFAULT NULL,
  `ai_review_finding` enum('valid_high','needs_changes','false_alarm') DEFAULT NULL,
  `ai_reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `ai_reviewed_at` timestamp NULL DEFAULT NULL,
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
  KEY `vouchers_payee_id_foreign` (`payee_id`),
  KEY `vouchers_ai_reviewed_by_foreign` (`ai_reviewed_by`),
  KEY `vouchers_flag_queue_index` (`company_id`,`ai_anomaly_flag`,`status`),
  CONSTRAINT `vouchers_ai_reviewed_by_foreign` FOREIGN KEY (`ai_reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `voucher_categories` (`id`),
  CONSTRAINT `vouchers_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_payee_department_id_foreign` FOREIGN KEY (`payee_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `vouchers_payee_id_foreign` FOREIGN KEY (`payee_id`) REFERENCES `payees` (`id`) ON DELETE SET NULL,
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
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (55,'2026_11_19_174142_add_deactivated_at_column_in_users_table',38);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (56,'2026_11_20_000001_remove_default_from_users_last_login_at',39);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (57,'2026_11_20_000002_add_personal_email_to_users',40);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (58,'2026_11_20_000003_create_security_alerts_table',41);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (59,'2026_11_21_000001_create_backups_table_and_system_alert_type',42);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (60,'2026_11_21_000002_add_two_factor_columns_to_users',43);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (61,'2026_11_21_000003_add_request_id_hash_and_indexes_to_audit_logs',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (62,'2026_11_21_000004_create_blocked_ips_table',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (63,'2026_11_21_000005_create_health_checks_and_incidents_tables',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (64,'2026_11_22_000001_add_unique_index_to_companies_name',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (65,'2026_11_22_000002_add_returned_to_vouchers_status',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (66,'2026_11_22_000003_add_invites_and_requests_to_user_company_access',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (67,'2026_11_25_000001_add_draft_expiry_notification_type',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (68,'2026_11_26_000001_create_payees_table',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (69,'2026_11_26_000002_add_support_request_notification_type',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (70,'2026_11_26_000003_add_review_details_to_voucher_approvals',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (71,'2026_11_27_000001_add_flag_review_to_vouchers',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (72,'2026_11_27_000002_make_budgets_yearly',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (73,'2026_11_27_000003_extend_ai_forecasts',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (74,'2026_11_27_000004_extend_financial_reports',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (75,'2026_11_27_000005_add_report_signoff',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (76,'2026_11_28_000001_create_idempotency_keys_table',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (77,'2026_11_28_000002_add_location_to_companies',44);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (78,'2026_11_28_000003_add_payee_email_to_vouchers',44);
