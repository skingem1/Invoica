/**
 * Redis Module Outputs
 * 
 * Exposes Redis cluster endpoints and configuration.
 */

output "redis_endpoint" {
  description = "Primary endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for the Redis cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = var.port
}

output "replication_group_id" {
  description = "Replication group ID"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_arn" {
  description = "Replication group ARN"
  value       = aws_elasticache_replication_group.main.arn
}

output "security_group_id" {
  description = "Security group ID for Redis cluster"
  value       = aws_security_group.redis.id
}

output "subnet_group_name" {
  description = "Subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

output "node_type" {
  description = "Node type"
  value       = var.node_type
}

output "engine_version" {
  description = "Engine version"
  value       = var.engine_version
}

output "num_node_groups" {
  description = "Number of node groups"
  value       = aws_elasticache_replication_group.main.num_node_groups
}

output "num_replicas" {
  description = "Total number of replicas"
  value       = aws_elasticache_replication_group.main.num_replicas
}

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value       = concat(
    aws_cloudwatch_metric_alarm.cpu[*].arn,
    aws_cloudwatch_metric_alarm.memory[*].arn,
    aws_cloudwatch_metric_alarm.evictions[*].arn,
    aws_cloudwatch_metric_alarm.replication_lag[*].arn
  )
}
