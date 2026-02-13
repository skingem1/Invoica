/**
 * RDS Module Variables
 * 
 * @module rds_variables
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "appdb"
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "dbadmin"
}

variable "master_password" {
  description = "Master password for the database (leave empty to generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "port" {
  description = "Port for the database"
  type        = number
  default     = 5432
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "instance_count" {
  description = "Number of cluster instances"
  type        = number
  default     = 2
}

# Serverless v2 scaling
variable "min_acus" {
  description = "Minimum Aurora Capacity Units (0.5 - 128)"
  type        = number
  default     = 0.5
}

variable "max_acus" {
  description = "Maximum Aurora Capacity Units (0.5 - 128)"
  type        = number
  default     = 16
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  type        = string
}

variable "vpc_security_group_ids" {
  description = "Security group IDs for the RDS cluster"
  type        = list(string)
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = ""
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "preferred_backup_window" {
  description = "Preferred backup window (e.g., '03:00-04:00')"
  type        = string
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
  description = "Preferred maintenance window (e.g., 'mon:04:00-mon:05:00')"
  type        = string
  default     = "mon:04:00-mon:05:00"
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_kms_key_id" {
  description = "KMS key for Performance Insights"
  type        = string
  default     = ""
}

variable "enabled_cloudwatch_logs_exports" {
  description = "CloudWatch logs to export"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "monitoring_interval" {
  description = "Monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "create_monitoring_role" {
  description = "Create IAM role for enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_role_arn" {
  description = "Existing monitoring role ARN"
  type        = string
  default     = ""
}

variable "create_secrets" {
  description = "Create Secrets Manager secret for credentials"
  type        = bool
  default     = true
}

variable "recovery_window_in_days" {
  description = "Recovery window for secrets"
  type        = number
  default     = 0
}

variable "secrets_kms_key_id" {
  description = "KMS key for secrets"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
