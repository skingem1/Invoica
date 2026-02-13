/**
 * RDS Module Outputs
 * 
 * @module rds_outputs
 */

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
