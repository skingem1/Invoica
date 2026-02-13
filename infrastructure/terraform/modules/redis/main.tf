/**
 * ElastiCache Redis Module
 * 
 * Creates an ElastiCache Redis cluster with t4g.small nodes,
 * including automatic backup and Redis-specific configurations.
 * 
 * @module redis
 * @requires terraform >= 1.0.0
 * @requires aws >= 5.0
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

################################################################################
# ElastiCache Parameter Group
################################################################################

resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.environment}-redis7"
  family = "redis7"
  
  # Redis 7 parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }
  
  # Enable Redis authentication
  parameter {
    name  = "requirepass"
    value = var.auth_token != "" ? var.auth_token : random_id.redis_auth[0].hex
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis7"
    }
  )
}

resource "random_id" "redis_auth" {
  count       = var.auth_token == "" ? 1 : 0
  byte_length = 32
  keepers = {
    # Generate new token when parameter group changes
    param_group = aws_elasticache_parameter_group.main.id
  }
}

################################################################################
# ElastiCache Subnet Group
################################################################################

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-cache-subnet"
  subnet_ids = var.subnet_ids
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-cache-subnet"
    }
  )
}

################################################################################
# ElastiCache Security Group
################################################################################

resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id
  
  ingress {
    description     = "Redis from application"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }
  
  # Allow traffic within the security group for cluster communication
  ingress {
    description     = "Redis internal"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    self            = true
  }
  
  egress {
    description     = "Outbound all"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-sg"
    }
  )
}

################################################################################
# ElastiCache Replication Group (Redis Cluster)
################################################################################

resource "aws_elasticache_replication_group" "main" {
  # Basic configuration
  replication_group_id       = "${var.environment}-redis"
  replication_group_description = "Redis cluster for ${var.environment}"
  
  # Engine and version
  engine               = "redis"
  engine_version      = var.engine_version
  node_type           = var.node_type
  
  # Cluster configuration
  num_cache_clusters  = var.num_cache_clusters
  port                = 6379
  
  # Subnet and security
  subnet_group_name   = aws_elasticache_subnet_group.main.name
  security_group_ids  = [aws_security_group.redis.id]
  
  # Parameter group
  parameter_group_name = aws_elasticache_parameter_group.main.name
  
  # Authentication
  auth_token_enabled = true
  auth_token         = var.auth_token != "" ? var.auth_token : random_id.redis_auth[0].hex
  
  # Automatic failover
  automatic_failover_enabled = var.num_cache_clusters > 1 ? true : false
  multi_az_enabled          = var.num_cache_clusters > 1 ? var.multi_az_enabled : false
  
  # At-rest encryption
  at_rest_encryption_enabled = true
  kms_key_id                = var.kms_key_id
  
  # In-transit encryption
  transit_encryption_enabled = true
  
  # Backup configuration
  auto_minor_version_upgrade = true
  automatic_backup_retention_days = var.backup_retention_days
  snapshot_retention_limit   = var.snapshot_retention_days
  snapshot_window           = var.snapshot_window
  maintenance_window        = var.maintenance_window
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format      = "json"
    log_type        = "slow-log"
  }
  
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format      = "json"
    log_type        = "engine-log"
  }
  
  # Final snapshot
  final_snapshot_identifier = var.create_final_snapshot ? "${var.environment}-redis-final-snapshot" : ""
  
  # Tags
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis"
    }
  )
  
  # Dependencies
  depends_on = [aws_elasticache_parameter_group.main]
}

################################################################################
# CloudWatch Log Groups for Redis
################################################################################

resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.environment}/redis/slow-log"
  retention_in_days = var.log_retention_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-slow-log"
    }
  )
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${var.environment}/redis/engine-log"
  retention_in_days = var.log_retention_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-engine-log"
    }
  )
}

################################################################################
# Secrets Manager Secret (optional)
################################################################################

resource "aws_secretsmanager_secret" "redis_credentials" {
  count                   = var.create_secrets ? 1 : 0
  name                    = "${var.environment}/redis/credentials"
  description             = "ElastiCache Redis credentials"
  recovery_window_in_days = var.recovery_window_in_days
  kms_key_id              = var.secrets_kms_key_id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-credentials-secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  count     = var.create_secrets ? 1 : 0
  secret_id = aws_secretsmanager_secret.redis_credentials[0].id
  
  secret_string = jsonencode({
    host     = aws_elasticache_replication_group.main.primary_endpoint_address
    port     = 6379
    auth_token = var.auth_token != "" ? var.auth_token : random_id.redis_auth[0].hex
  })
}

################################################################################
# Outputs
################################################################################

output "redis_endpoint" {
  description = "Primary endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Port of the Redis cluster"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "replication_group_id" {
  description = "ID of the replication group"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "ARN of the replication group"
  value       = aws_elasticache_replication_group.main.arn
}

output "security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "auth_token" {
  description = "Redis authentication token"
  value       = var.auth_token != "" ? var.auth_token : random_id.redis_auth[0].hex
  sensitive   = true
}

output "secretsmanager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = var.create_secrets ? aws_secretsmanager_secret.redis_credentials[0].arn : ""
}
