/**
 * ElastiCache Redis Module
 * 
 * Creates a Redis cluster with t4g.small nodes, automatic failover,
 * and multi-AZ deployment for high availability.
 * 
 * @module redis
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
# ElastiCache Subnet Group
# =============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-subnet-group"
    }
  )
}

# =============================================================================
# ElastiCache Security Group
# =============================================================================

resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "Redis from allowed security groups"
  }
  
  ingress {
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Redis from allowed CIDRs"
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
      Name = "${var.environment}-redis-sg"
    }
  )
}

# =============================================================================
# Redis Parameter Group
# =============================================================================

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.environment}-redis-pg"
  family = var.engine == "redis" ? "redis7" : "redis6.x"
  
  dynamic "parameter" {
    for_each = var.custom_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-pg"
    }
  )
}

# =============================================================================
# ElastiCache Replication Group
# =============================================================================

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.environment}-redis"
  replication_group_description = "Redis cluster for ${var.environment}"
  
  engine                     = var.engine
  engine_version            = var.engine_version
  node_type                  = var.node_type
  
  port                       = var.port
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  
  # Cluster mode configuration
  num_node_groups         = var.num_node_groups
  replicas_per_node_group = var.replicas_per_node_group
  
  # Automatic failover
  automatic_failover_enabled = var.automatic_failover_enabled
  
  # Multi-AZ
  multi_az_enabled = var.multi_az_enabled
  
  # At-rest encryption
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  kms_key_id                = var.kms_key_id
  
  # Transit encryption
  transit_encryption_enabled = var.transit_encryption_enabled
  
  # Auth token for Redis ACL
  auth_token_enabled = var.auth_token_enabled
  
  # Backup configuration
  automatic_backup_retention_days = var.backup_retention_days
  preferred_backup_window         = var.backup_window
  preferred_maintenance_window    = var.maintenance_window
  
  # Snapshot
  snapshot_retention_limit   = var.snapshot_retention_days
  snapshot_window           = var.snapshot_window
  
  # Log delivery
  dynamic "log_delivery_configuration" {
    for_each = var.enable_slow_log ? [1] : []
    content {
      destination      = aws_elasticache_cloudwatch_log_group.slow_log[0].name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "slow-log"
    }
  }
  
  dynamic "log_delivery_configuration" {
    for_each = var.enable_engine_log ? [1] : []
    content {
      destination      = aws_elasticache_cloudwatch_log_group.engine_log[0].name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "engine-log"
    }
  }
  
  # Apply immediately
  apply_immediately = var.apply_immediately
  
  # Final snapshot
  final_snapshot_identifier = var.final_snapshot_enabled ? "${var.environment}-redis-final-snapshot" : null
  
  # Description
  description = var.description
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis"
    }
  )
}

# =============================================================================
# CloudWatch Log Groups for Redis Logs
# =============================================================================

resource "aws_elasticache_cloudwatch_log_group" "slow_log" {
  count = var.enable_slow_log ? 1 : 0
  
  name              = "/aws/elasticache/redis/${var.environment}/slow-log"
  retention_in_days = var.log_retention_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-slow-log"
    }
  )
}

resource "aws_elasticache_cloudwatch_log_group" "engine_log" {
  count = var.enable_engine_log ? 1 : 0
  
  name              = "/aws/elasticache/redis/${var.environment}/engine-log"
  retention_in_days = var.log_retention_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-engine-log"
    }
  )
}

# =============================================================================
# CloudWatch Alarms
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "cpu" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-redis-cpu"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "Redis cluster CPU utilization alarm"
  
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-cpu-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "memory" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-redis-memory"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Maximum"
  threshold           = var.memory_alarm_threshold
  alarm_description   = "Redis cluster memory usage alarm"
  
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-memory-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "evictions" {
  count = var.create_alarms ? 1 : 0
  
  alarm_name           = "${var.environment}-redis-evictions"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = var.evictions_alarm_threshold
  alarm_description   = "Redis cluster evictions alarm"
  
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-evictions-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "replication_lag" {
  count = var.create_alarms && var.automatic_failover_enabled ? 1 : 0
  
  alarm_name           = "${var.environment}-redis-replication-lag"
  comparison_operator  = "GreaterThanThreshold"
  evaluation_periods   = 2
  metric_name          = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.replication_lag_threshold
  alarm_description   = "Redis replication lag alarm"
  
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-replication-lag-alarm"
    }
  )
}
