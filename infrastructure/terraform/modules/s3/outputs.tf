/**
 * S3 Module Outputs
 * 
 * Exposes S3 bucket ARNs and names for use by other modules.
 */

output "invoices_bucket_id" {
  description = "Invoices bucket ID"
  value       = aws_s3_bucket.invoices.id
}

output "invoices_bucket_arn" {
  description = "Invoices bucket ARN"
  value       = aws_s3_bucket.invoices.arn
}

output "invoices_bucket_name" {
  description = "Invoices bucket name"
  value       = aws_s3_bucket.invoices.bucket
}

output "assets_bucket_id" {
  description = "Assets bucket ID"
  value       = var.create_assets_bucket ? aws_s3_bucket.assets[0].id : null
}

output "assets_bucket_arn" {
  description = "Assets bucket ARN"
  value       = var.create_assets_bucket ? aws_s3_bucket.assets[0].arn : null
}

output "assets_bucket_name" {
  description = "Assets bucket name"
  value       = var.create_assets_bucket ? aws_s3_bucket.assets[0].bucket : null
}

output "logs_bucket_id" {
  description = "Logs bucket ID"
  value       = var.create_logs_bucket ? aws_s3_bucket.logs[0].id : null
}

output "logs_bucket_arn" {
  description = "Logs bucket ARN"
  value       = var.create_logs_bucket ? aws_s3_bucket.logs[0].arn : null
}

output "logs_bucket_name" {
  description = "Logs bucket name"
  value       = var.create_logs_bucket ? aws_s3_bucket.logs[0].bucket : null
}

output "app_data_bucket_id" {
  description = "App data bucket ID"
  value       = var.create_app_data_bucket ? aws_s3_bucket.app_data[0].id : null
}

output "app_data_bucket_arn" {
  description = "App data bucket ARN"
  value       = var.create_app_data_bucket ? aws_s3_bucket.app_data[0].arn : null
}

output "app_data_bucket_name" {
  description = "App data bucket name"
  value       = var.create_app_data_bucket ? aws_s3_bucket.app_data[0].bucket : null
}
