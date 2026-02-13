/**
 * RDS Aurora Serverless v2 Module
 * 
 * Creates an Aurora PostgreSQL 15 cluster with Serverless v2 scaling,
 * automatic backup retention, and multi-AZ deployment.
 * 
 * @module rds
 * @requires terraform >= 1.0.0
 * @requires aws >= 5.0.0
 */

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# =============================================================================
# Secrets Manager for Database Credentials
# =============================================================================

resource "aws_secretsmanager_secret" "db_credentials" {
  name_prefix = "${var.environment}-aurora-"
  description = "Aurora PostgreSQL credentials"
  
  recovery_window_in_days = var.recovery_window_in_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-db-credentials"
      Type = "database-credentials"
    }
  )
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  
  secret_string = jsonencode({
    username = var.master_username
    password = var.create_random_password ? random_password.db_password[0].result : var.master_password
  })
}

resource "random_password" "db_password" {
  count   = var.create_random_password ? 1 : 0
  length  = 32
  special = true
  numeric  = true
  upper   = true
  lower   = true
  
  keepers = {
    username = var.master_username
  }
}

# =============================================================================
# RDS Subnet Group (uses VPC module outputs)
# =============================================================================

resource "aws_db_subnet_group" "aurora" {
  name       = "${var.environment}-aurora-subnet-group"
  subnet_ids = var.db_subnet_ids
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-subnet-group"
    }
  )
}

# =============================================================================
# Security Group for Aurora Cluster
# =============================================================================

resource "aws_security_group" "aurora" {
  name        = "${var.environment}-aurora-sg"
  description = "Security group for Aurora PostgreSQL cluster"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "PostgreSQL from allowed security groups"
  }
  
  ingress {
    from_port   = var.db_port
    to_port     = var.db_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "PostgreSQL from allowed CIDRs"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-sg"
    }
  )
}

# =============================================================================
# IAM Role for Enhanced Monitoring
# =============================================================================

resource "aws_iam_role" "enhanced_monitoring" {
  name = "${var.environment}-rds-enhanced-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "enhanced_monitoring" {
  name = "${var.environment}-rds-enhanced-monitoring-policy"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "enhanced_monitoring" {
  role       = aws_iam_role.enhanced_monitoring.name
  policy_arn = aws_iam_policy.enhanced_monitoring.arn
}

# =============================================================================
# Aurora Cluster Parameter Group
# =============================================================================

resource "aws_rds_cluster_parameter_group" "aurora" {
  name   = "${var.environment}-aurora-pg"
  family = "aurora-postgresql15"
  
  parameter {
    name  = "rds.force_ssl"
    value = var.force_ssl ? "1" : "0"
  }
  
  parameter {
    name  = "rds.logical_replication"
    value = "1"
  }
  
  parameter {
    name  = "shared_buffers"
    value = var.shared_buffers
  }
  
  parameter {
    name  = "work_mem"
    value = var.work_mem
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-pg"
    }
  )
}

# =============================================================================
# DB Cluster
# =============================================================================

resource "aws_rds_cluster" "aurora" {
  cluster_identifier     = "${var.environment}-aurora-cluster"
  engine                 = "aurora-postgresql"
  engine_version         = var.engine_version
  engine_mode            = "provisioned"
  
  serverlessv2_scale_configuration {
    min_capacity = var.min_acus
    max_capacity = var.max_acus
  }
  
  database_name           = var.database_name
  master_username        = var.create_random_password ? "dbadmin" : var.master_username
  master_password        = var.create_random_password ? random_password.db_password[0].result : var.master_password
  
  db_subnet_group_name    = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]
  
  port                    = var.db_port
  
  storage_encrypted       = true
  kms_key_id             = var.kms_key_arn
  
  backup_retention_period = var.backup_retention_days
  preferred_backup_window = var.backup_window
  preferred_maintenance_window = var.maintenance_window
  
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.environment}-aurora-final-snapshot"
  
  enabled_cloudwatch_logs_exports = var.enabled_log_exports
  
  scaling_configuration {
    min_capacity = var.min_acus
    max_capacity = var.max_acus
    seconds_until_auto_pause = 300
    auto_pause = true
  }
  
  iam_database_authentication_enabled = true
  
  performance_insights_enabled        = var.enable_performance_insights
  performance_insights_retention_period = var.performance_insights_retention_days
  
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.enhanced_monitoring.arn : null
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-cluster"
    }
  )
}

# =============================================================================
# DB Cluster Instances
# =============================================================================

resource "aws_rds_cluster_instance" "aurora" {
  count = var.replicas_count
  
  identifier         = "${var.environment}-aurora-instance-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.aurora.id
  
  engine                 = aws_rds_cluster.aurora.engine
  engine_version         = aws_rds_cluster.aurora.engine_version
  instance_class         = var.instance_class
  
  publicly_accessible = false
  
  performance_insights_enabled = var.enable_performance_insights
  
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.enhanced_monitoring.arn : null
  
  ca_cert_identifier = "rds-ca-rsa2048-g1"
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-instance-${count.index + 1}"
    }
  )
}

# =============================================================================
# Optional: Read Replica for Production
# =============================================================================

resource "aws_rds_cluster_instance" "reader" {
  count = var.create_reader_instance ? 1 : 0
  
  identifier         = "${var.environment}-aurora-reader"
  cluster_identifier = aws_rds_cluster.aurora.id
  
  engine                 = aws_rds_cluster.aurora.engine
  engine_version         = aws_rds_cluster.aurora.engine_version
  instance_class         = var.reader_instance_class
  
  publicly_accessible = false
  
  performance_insights_enabled = var.enable_performance_insights
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-reader"
    }
  )
}

# =============================================================================
# CloudWatch Alarms for Aurora
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-aurora-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "Aurora cluster CPU utilization alarm"
  
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-cpu-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "connections" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-aurora-connections"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "DatabaseConnections"
  namespace            = "AWS/RDS"
  period               = 300
  statistic            = "Sum"
  threshold            = var.connections_alarm_threshold
  alarm_description    = "Aurora cluster connections alarm"
  
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-connections-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "serverless_scaling" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-aurora-serverless-capacity"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "ServerlessDatabaseCapacity"
  namespace            = "AWS/RDS"
  period               = 60
  statistic            = "Maximum"
  threshold            = var.max_acus * 0.9
  alarm_description    = "Aurora Serverless capacity approaching maximum"
  
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-aurora-scaling-alarm"
    }
  )
}
