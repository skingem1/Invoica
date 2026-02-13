/**
 * RDS Aurora Serverless v2 Module Variables
 * 
 * Configuration for Aurora PostgreSQL 15 with Serverless v2.
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "db_subnet_ids" {
  description = "Subnet IDs for RDS cluster"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID for security group"
  type        = string
}

variable "database_name" {
  description = "Name of the initial database"
  type        = string
  default     = "appdb"
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_$]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "dbadmin"
}

variable "master_password" {
  description = "Master password for the database (required if create_random_password is false)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_random_password" {
  description = "Generate random password for the database"
  type        = bool
  default     = true
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "min_acus" {
  description = "Minimum Aurora Capacity Units (0.5-128)"
  type        = number
  default     = 0.5
  
  validation {
    condition     = var.min_acus >= 0.5 && var.min_acus <= 128
    error_message = "Min ACUs must be between 0.5 and 128"
  }
}

variable "max_acus" {
  description = "Maximum Aurora Capacity Units (1-128)"
  type        = number
  default     = 16
  
  validation {
    condition     = var.max_acus >= 1 && var.max_acus <= 128
    error_message = "Max ACUs must be between 1 and 128"
  }
}

variable "instance_class" {
  description = "Instance class for Aurora writer (used for provisioned fallback)"
  type        = string
  default     = "db.serverless"
}

variable "reader_instance_class" {
  description = "Instance class for Aurora reader"
  type        = string
  default     = "db.serverless"
}

variable "replicas_count" {
  description = "Number of read replicas (0 for serverless only)"
  type        = number
  default     = 0
}

variable "create_reader_instance" {
  description = "Create a reader instance for read scaling"
  type        = bool
  default     = false
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access the database"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the database"
  type        = list(string)
  default     = []
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "mon:04:00-mon:05:00"
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = ""
}

variable "enabled_log_exports" {
  description = "Enabled CloudWatch log exports"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "force_ssl" {
  description = "Force SSL connections"
  type        = bool
  default     = true
}

variable "shared_buffers" {
  description = "PostgreSQL shared_buffers parameter"
  type        = string
  default     = "{DBInstanceClassMemory/32768}"
}

variable "work_mem" {
  description = "PostgreSQL work_mem parameter"
  type        = string
  default     = "4MB"
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "Monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_days" {
  description = "Performance Insights retention period"
  type        = number
  default     = 7
}

variable "create_alarms" {
  description = "Create CloudWatch alarms"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "SNS topic ARNs for alarm actions"
  type        = list(string)
  default     = []
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization alarm threshold percentage"
  type        = number
  default     = 80
}

variable "connections_alarm_threshold" {
  description = "Connections alarm threshold"
  type        = number
  default     = 1000
}

variable "recovery_window_in_days" {
  description = "Secrets Manager recovery window in days"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
