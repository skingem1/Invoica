/**
 * RDS Aurora Serverless v2 Module
 * 
 * Creates an Aurora Serverless v2 PostgreSQL cluster with auto-scaling ACUs.
 * Supports multi-AZ deployment with automatic failover.
 * 
 * @module rds
 * @requires terraform-aws-modules/rds-aurora/aws >= 8.0
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
  description = "VPC ID where RDS will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for RDS cluster (should be database subnets)"
  type        = list(string)
}

variable "db_name" {
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
  description = "Master password for the database (use SSM parameter or secrets manager in production)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "serverlessv2_scaling_configuration" {
  description = "Serverless v2 scaling configuration"
  type = object({
    min_capacity = number
    max_capacity = number
  })
  default = {
    min_capacity = 0.5
    max_capacity = 16
  }
}

variable "backup_retention_period" {
  description = "Days to retain backups"
  type        = number
  default     = 7
}

variable "preferred_backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "preferred_maintenance_window" {
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
  description = "Skip final snapshot on deletion (for dev only)"
  type        = bool
  default     = false
}

variable "final_snapshot_identifier" {
  description = "Final snapshot identifier"
  type        = string
  default     = null
}

variable "enable_http_endpoint" {
  description = "Enable HTTP endpoint for Aurora Serverless v2"
  type        = bool
  default     = false
}

variable "copy_tags_to_snapshot" {
  description = "Copy tags to snapshots"
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
}

variable "cloudwatch_log_exports" {
  description = "CloudWatch log exports"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "enabled_cloudwatch_logs_exports" {
  description = "Enabled CloudWatch logs exports"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
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

# Get the master password from SSM Parameter Store if not provided
data "aws_ssm_parameter" "db_password" {
  count = var.master_password == "" ? 1 : 0
  name  = "/${var.environment}/rds/master-password"
}

locals {
  db_password = var.master_password != "" ? var.master_password : try(data.aws_ssm_parameter.db_password[0].value, "changeme")
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS Aurora cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.database_port
    to_port         = var.database_port
    protocol        = "tcp"
    security_groups = var.vpc_security_group_ids
    description     = "PostgreSQL from allowed security groups"
  }

  ingress {
    from_port   = var.database_port
    to_port     = var.database_port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "PostgreSQL from VPC"
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

# RDS Aurora Serverless v2 Cluster
module "aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "8.4.0"

  # Naming
  # The "random" resource below requires the random provider
  # For production, use a stable name or pass it as a variable
  cluster_identifier = "${var.environment}-aurora-postgresql"

  # Engine configuration
  engine               = "aurora-postgresql"
  engine_mode          = "provisioned"  # Serverless v2 uses provisioned mode
  engine_version       = var.engine_version
  database_name        = var.db_name
  master_username      = var.master_username
  master_password      = local.db_password
  port                 = var.database_port

  # Serverless v2 configuration
  serverlessv2_scaling_configuration = {
    min_capacity = var.serverlessv2_scaling_configuration.min_capacity
    max_capacity = var.serverlessv2_scaling_configuration.max_capacity
  }

  # Storage
  storage_encrypted   = var.storage_encrypted
  kms_key_id          = "alias/aws/rds"  # Use default AWS KMS key

  # Network
  vpc_id                 = var.vpc_id
  subnets                = var.subnet_ids
  create_db_subnet_group = true

  # Security groups
  security_group_ids = concat([aws_security_group.rds.id], var.vpc_security_group_ids)

  # Backup and maintenance
  backup_retention_period   = var.backup_retention_period
  preferred_backup_window   = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.final_snapshot_identifier

  # Monitoring
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  create_cloudwatch_log_group     = true
  cloudwatch_log_group_retention  = 7

  # Performance Insights
  performance_insights_enabled            = var.performance_insights_enabled
  performance_insights_retention_period   = var.performance_insights_retention_period
  create_performance_insights_kms_key     = false  # Use default AWS KMS key

  # Tags
  tags = local.common_tags
}

# Database Instance Auto Minor Version Upgrade
resource "aws_rds_cluster_instance" "this" {
  count = length(var.subnet_ids) > 2 ? 3 : length(var.subnet_ids)

  identifier         = "${var.environment}-aurora-instance-${count.index}"
  cluster_identifier = module.aurora.arn

  # Instance configuration
  instance_class    = "db.serverless"  # Serverless v2 uses serverless instance class
  engine            = module.aurora.engine
  engine_version    = module.aurora.engine_version

  # Publicly accessible
  publicly_accessible = false

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Promotion tier (0 for primary, 1+ for replicas)
  promotion_tier = count.index

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# Outputs
output "cluster_id" {
  description = "ID of the RDS cluster"
  value       = module.aurora.cluster_id
}

output "cluster_arn" {
  description = "ARN of the RDS cluster"
  value       = module.aurora.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint of the RDS cluster"
  value       = module.aurora.cluster_endpoint
  sensitive   = true
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint of the RDS cluster"
  value       = module.aurora.cluster_reader_endpoint
  sensitive   = true
}

output "cluster_port" {
  description = "Port of the RDS cluster"
  value       = module.aurora.cluster_port
}

output "cluster_security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.rds.id
}

output "database_name" {
  description = "Name of the database"
  value       = var.db_name
}
