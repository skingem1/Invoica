/**
 * Redis Module Outputs
 * 
 * @module redis_outputs
 */

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
