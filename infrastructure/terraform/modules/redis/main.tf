/**
 * ElastiCache Redis Module
 * 
 * Creates an ElastiCache Redis cluster with t4g.small nodes.
 * Supports cluster mode disabled for simpler configuration.
 * 
 * @module redis
 * @requires terraform-aws-modules/elasticache/aws >= 8.0
 */

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "vpc_id" {
  description = "VPC ID where ElastiCache will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for ElastiCache (should be database subnets)"
  type        = list(string)
}

variable "node_type" {
  description = "Node type for Redis cluster (e.g., t4g.small)"
  type        = string
  default     = "cache.t4g.small"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes in the cluster"
  type        = number
  default     = 2
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

variable "parameter_group_name" {
  description = "Redis parameter group name"
  type        = string
  default     = null
}

variable "at_rest_encryption_enabled" {
  description = "Enable at-rest encryption"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable in-transit encryption"
  type        = bool
  default     = true
}

variable "auth_token_enabled" {
  description = "Enable Redis auth token (requires transit encryption)"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Redis auth token (use SSM parameter in production)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover (requires multi-node)"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable multi-AZ deployment"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 7
}

variable "snapshot_window" {
  description = "Snapshot window (UTC)"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Maintenance window (UTC)"
  type        = string
  default     = "mon:05:00-mon:06:00"
}

variable "log_delivery_configuration" {
  description = "Log delivery configuration"
  type = list(object({
    destination      = string
    destination_type = string
    log_format       = string
    log_type         = string
  }))
  default = []
}

variable "vpc_security_group_ids" {
  description = "Additional VPC security group IDs"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

locals {
  common_tags = merge(
    {
      Environment = var.environment
      Project     = "infrastructure"
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Get auth token from SSM Parameter Store if not provided
data "aws_ssm_parameter" "redis_auth_token" {
  count = var.auth_token == "" ? 1 : 0
  name  = "/${var.environment}/redis/auth-token"
}

locals {
  redis_auth_token = var.auth_token != "" ? var.auth_token : try(data.aws_ssm_parameter.redis_auth_token[0].value, "changeme")
}

# Security Group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    security_groups = var.vpc_security_group_ids
    description     = "Redis from allowed security groups"
  }

  ingress {
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "Redis from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# Subnet group for ElastiCache
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = local.common_tags
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  count = var.parameter_group_name == null ? 1 : 0

  name   = "${var.environment}-redis-params"
  family = "redis${split(".", var.engine_version)[0]}"

  # Common Redis parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = local.common_tags
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "main" {
  # Basic configuration
  replication_group_id       = "${var.environment}-redis"
  replication_group_description = "Redis cluster for ${var.environment}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  port                 = var.port
  parameter_group_name = var.parameter_group_name != null ? var.parameter_group_name : aws_elasticache_parameter_group.main[0].name

  # Network
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = concat([aws_security_group.redis.id], var.vpc_security_group_ids)
  transit_encryption_enabled = var.transit_encryption_enabled
  at_rest_encryption_enabled = var.at_rest_encryption_enabled

  # Auth token
  auth_token_enabled = var.auth_token_enabled
  auth_token         = var.auth_token_enabled ? local.redis_auth_token : null

  # High availability
  automatic_failover_enabled = var.num_cache_nodes > 1 ? var.automatic_failover_enabled : false
  multi_az_enabled            = var.num_cache_nodes > 1 ? var.multi_az_enabled : false

  # Backup and maintenance
  snapshot_retention_limit   = var.snapshot_retention_limit
  snapshot_window            = var.snapshot_window
  maintenance_window         = var.maintenance_window
  auto_minor_version_upgrade = true

  # Log delivery (if configured)
  dynamic "log_delivery_configuration" {
    for_each = var.log_delivery_configuration
    content {
      destination      = log_delivery_configuration.value.destination
      destination_type = log_delivery_configuration.value.destination_type
      log_format       = log_delivery_configuration.value.log_format
      log_type         = log_delivery_configuration.value.log_type
    }
  }

  # Tags
  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [engine_version]
  }
}

# Outputs
output "redis_endpoint" {
  description = "Primary endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Port of the Redis cluster"
  value       = aws_elasticache_replication_group.main.port
}

output "replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.redis.id
}
