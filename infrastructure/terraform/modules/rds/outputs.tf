/**
 * RDS Module Outputs
 * 
 * Exposes Aurora cluster endpoints and connection information.
 */

output "cluster_identifier" {
  description = "Aurora cluster identifier"
  value       = aws_rds_cluster.aurora.id
}

output "cluster_endpoint" {
  description = "Writer endpoint for the Aurora cluster"
  value       = aws_rds_cluster.aurora.endpoint
  sensitive   = true
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for the Aurora cluster"
  value       = aws_rds_cluster.aurora.reader_endpoint
  sensitive   = true
}

output "cluster_arn" {
  description = "Aurora cluster ARN"
  value       = aws_rds_cluster.aurora.arn
}

output "cluster_resource_id" {
  description = "Aurora cluster resource ID"
  value       = aws_rds_cluster.aurora.resource_id
}

output "db_name" {
  description = "Database name"
  value       = var.database_name
}

output "db_port" {
  description = "Database port"
  value       = var.db_port
}

output "db_security_group_id" {
  description = "Security group ID for Aurora cluster"
  value       = aws_security_group.aurora.id
}

output "db_subnet_group_name" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.aurora.name
}

output "secret_arn" {
  description = "Secrets Manager secret ARN for database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "secret_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "instance_ids" {
  description = "List of Aurora instance IDs"
  value       = aws_rds_cluster_instance.aurora[*].id
}

output "reader_instance_id" {
  description = "Reader instance ID (if created)"
  value       = length(aws_rds_cluster_instance.reader) > 0 ? aws_rds_cluster_instance.reader[0].id : null
}

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value       = aws_cloudwatch_metric_alarm.cpu_utilization[*].arn
}
