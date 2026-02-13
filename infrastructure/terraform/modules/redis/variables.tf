/**
 * ElastiCache Redis Module Variables
 * 
 * Configuration for Redis cluster with t4g.small nodes.
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "subnet_ids" {
  description = "Subnet IDs for Redis cluster"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID for security group"
  type        = string
}

variable "node_type" {
  description = "Node type for Redis cluster"
  type        = string
  default     = "cache.t4g.small"
}

variable "engine" {
  description = "Redis engine"
  type        = string
  default     = "redis"
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "num_node_groups" {
  description = "Number of node groups (shards) for Redis Cluster mode"
  type        = number
  default     = 1
}

variable "replicas_per_node_group" {
  description = "Number of replicas per node group"
  type        = number
  default     = 1
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

variable "at_rest_encryption_enabled" {
  description = "Enable at-rest encryption"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable transit encryption"
  type        = bool
  default     = true
}

variable "auth_token_enabled" {
  description = "Enable AUTH token"
  type        = bool
  default     = true
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

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "mon:05:00-mon:06:00"
}

variable "snapshot_retention_days" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

variable "snapshot_window" {
  description = "Preferred snapshot window (UTC)"
  type        = string
  default     = "04:00-05:00"
}

variable "apply_immediately" {
  description = "Apply changes immediately"
  type        = bool
  default     = false
}

variable "final_snapshot_enabled" {
  description = "Enable final snapshot on deletion"
  type        = bool
  default     = true
}

variable "description" {
  description = "Description for the replication group"
  type        = string
  default     = "Managed by Terraform"
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access Redis"
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access Redis"
  type        = list(string)
  default     = []
}

variable "custom_parameters" {
  description = "Custom Redis parameters"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "enable_slow_log" {
  description = "Enable slow log"
  type        = bool
  default     = true
}

variable "enable_engine_log" {
  description = "Enable engine log"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
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
  default     = 75
}

variable "memory_alarm_threshold" {
  description = "Memory usage alarm threshold percentage"
  type        = number
  default     = 80
}

variable "evictions_alarm_threshold" {
  description = "Evictions alarm threshold"
  type        = number
  default     = 1000
}

variable "replication_lag_threshold" {
  description = "Replication lag alarm threshold in seconds"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
