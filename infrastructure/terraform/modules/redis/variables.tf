/**
 * Redis Module Variables
 * 
 * @module redis_variables
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for ElastiCache"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access Redis"
  type        = list(string)
  default     = []
}

variable "node_type" {
  description = "Node type for Redis (e.g., t4g.small, cache.t3.medium)"
  type        = string
  default     = "cache.t4g.small"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters in the replication group"
  type        = number
  default     = 2
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Redis auth token (leave empty to generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = ""
}

variable "backup_retention_days" {
  description = "Number of days to retain automatic backups"
  type        = number
  default     = 7
}

variable "snapshot_retention_days" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

variable "snapshot_window" {
  description = "Snapshot window (e.g., '03:00-05:00')"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Maintenance window (e.g., 'mon:05:00-mon:07:00')"
  type        = string
  default     = "mon:05:00-mon:07:00"
}

variable "log_retention_days" {
  description = "CloudWatch log retention days"
  type        = number
  default     = 7
}

variable "create_final_snapshot" {
  description = "Create final snapshot on deletion"
  type        = bool
  default     = true
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
