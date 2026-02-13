/**
 * RDS Aurora Serverless v2 Module
 * 
 * Creates an Aurora Serverless v2 PostgreSQL 15 database with auto-scaling
 * capabilities and automatic backup configuration.
 * 
 * @module rds
 * @requires terraform >= 1.0.0
 * @requires aws >= 5.0
 * @requires random >= 3.0
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

locals {
  # Generate password if not provided
  password = var.master_password != "" ? var.master_password : random_id.db_password[0].hex
}

resource "random_id" "db_password" {
  count       = var.master_password == "" ? 1 : 0
  byte_length = 32
}

################################################################################
# Aurora Cluster
################################################################################

resource "aws_rds_cluster" "main" {
  cluster_identifier        = "${var.environment}-aurora-postgres"
  engine                    = "aurora-postgresql"
  engine_mode               = "provisioned"
  engine_version            = var.engine_version
  database_name             = var.database_name
  master_username           = var.master_username
  master_password           = local.password
  port                      = var.port
  
  # Serverless v2 configuration
  serverlessv2_scaling_configuration {
    min_capacity = var.min_acus
    max_capacity = var.max_acus
  }
  
  # Storage
  storage_type              = "aurora"
  allocated_storage         = var.allocated_storage
  storage_encrypted         = true
  kms_key_id                = var.kms_key_id
  
  # Network
  db_subnet_group_name      = var.db_subnet_group_name
  vpc_security_group_ids    = var.vpc_security_group_ids
  
  # Backup and retention
  backup_retention_period   = var.backup_retention_days
  preferred_backup_window   = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window
  
  # Deletion protection
  deletion_protection       = var.deletion_protection
  
  # Performance Insights
  enable_performance_insights = var.enable_performance_insights
  performance_insights_kms_key_id = var.performance_insights_kms_key_id
  
  # Logging
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  
  # Global Database (optional cross-region replication)
  # global_cluster_identifier = var.global_cluster_identifier
  
  # Tags
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-cluster"
    }
  )
}

################################################################################
# Aurora Cluster Instance
################################################################################

resource "aws_rds_cluster_instance" "main" {
  count                     = var.instance_count
  cluster_identifier        = aws_rds_cluster.main.id
  instance_identifier       = "${var.environment}-aurora-instance-${count.index + 1}"
  engine                    = aws_rds_cluster.main.engine
  engine_version            = aws_rds_cluster.main.engine_version
  
  # Instance class - for Serverless v2 this is auto-selected based on ACU
  instance_class            = "db.serverless"
  
  # Publicly accessible
  publicly_accessible       = false
  
  # Auto minor version upgrade
  auto_minor_version_upgrade = true
  
  # Monitoring
  monitoring_interval       = var.monitoring_interval
  monitoring_role_arn       = var.create_monitoring_role ? aws_iam_role.rds_monitoring[0].arn : var.monitoring_role_arn
  
  # Performance Insights
  performance_insights_enabled = var.enable_performance_insights
  
  # Tags
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-instance-${count.index + 1}"
    }
  )
  
  # Wait for cluster to be ready before creating instances
  depends_on = [aws_rds_cluster.main]
}

################################################################################
# IAM Role for Enhanced Monitoring
################################################################################

resource "aws_iam_role" "rds_monitoring" {
  count                  = var.create_monitoring_role ? 1 : 0
  name                   = "${var.environment}-rds-monitoring-role"
  description            = "Role for RDS enhanced monitoring"
  assume_role_policy     = data.aws_iam_policy_document.rds_monitoring_assume[0].json
  force_detach_policies  = true
}

data "aws_iam_policy_document" "rds_monitoring_assume" {
  count = var.create_monitoring_role ? 1 : 0
  
  statement {
    effect = "Allow"
    
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
    
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count      = var.create_monitoring_role ? 1 : 0
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

################################################################################
# Secrets Manager Secret (optional)
################################################################################

resource "aws_secretsmanager_secret" "db_credentials" {
  count                   = var.create_secrets ? 1 : 0
  name                    = "${var.environment}/aurora-postgres/credentials"
  description             = "Aurora PostgreSQL credentials"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.secrets_kms_key_id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-db-credentials-secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count     = var.create_secrets ? 1 : 0
  secret_id = aws_secretsmanager_secret.db_credentials[0].id
  
  secret_string = jsonencode({
    username = var.master_username
    password = local.password
    engine   = "postgres"
    host     = aws_rds_cluster.main.endpoint
    port     = var.port
    dbname   = var.database_name
  })
}

################################################################################
# Parameter Group
################################################################################

resource "aws_rds_cluster_parameter_group" "main" {
  name   = "${var.environment}-aurora-pg15"
  family = "aurora-postgresql15"
  
  # PostgreSQL 15 parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }
  
  parameter {
    name  = "track_activities"
    value = "on"
  }
  
  parameter {
    name  = "track_counts"
    value = "on"
  }
  
  parameter {
    name  = "track_io_timing"
    value = "on"
  }
  
  parameter {
    name  = "track_functions"
    value = "pl"
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-pg15"
    }
  )
}

################################################################################
# Outputs
################################################################################

output "cluster_arn" {
  description = "ARN of the Aurora cluster"
  value       = aws_rds_cluster.main.arn
}

output "cluster_id" {
  description = "ID of the Aurora cluster"
  value       = aws_rds_cluster.main.id
}

output "cluster_endpoint" {
  description = "Writer endpoint for the cluster"
  value       = aws_rds_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for the cluster"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "cluster_port" {
  description = "Port of the cluster"
  value       = aws_rds_cluster.main.port
}

output "cluster_resource_id" {
  description = "Resource ID of the cluster"
  value       = aws_rds_cluster.main.resource_id
}

output "instance_ids" {
  description = "IDs of the cluster instances"
  value       = aws_rds_cluster_instance.main[*].id
}

output "instance_endpoints" {
  description = "Endpoints of the cluster instances"
  value       = aws_rds_cluster_instance.main[*].endpoint
}

output "secretsmanager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = var.create_secrets ? aws_secretsmanager_secret.db_credentials[0].arn : ""
}

output "db_name" {
  description = "Name of the database"
  value       = var.database_name
}

output "master_username" {
  description = "Master username"
  value       = var.master_username
}
