/**
 * S3 Module Variables
 * 
 * Configuration for S3 buckets with Intelligent-Tiering.
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "bucket_prefix" {
  description = "Prefix for bucket names"
  type        = string
  default     = "app"
}

variable "bucket_name" {
  description = "Exact bucket name (if creating new bucket is false)"
  type        = string
  default     = ""
}

variable "create_new_bucket" {
  description = "Create new bucket with prefix"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "enable_intelligent_tiering" {
  description = "Enable S3 Intelligent-Tiering"
  type        = bool
  default     = true
}

variable "enable_lifecycle_rules" {
  description = "Enable lifecycle rules"
  type        = bool
  default     = true
}

variable "lifecycle_expiration_days" {
  description = "Days before lifecycle expiration"
  type        = number
  default     = 2555  # ~7 years
}

variable "sse_algorithm" {
  description = "Server-side encryption algorithm"
  type        = string
  default     = "AES256"
  
  validation {
    condition     = can(regex("^(AES256|aws:kms)$", var.sse_algorithm))
    error_message = "Must be AES256 or aws:kms"
  }
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = ""
}

variable "cloudfront_origin_access_control_id" {
  description = "CloudFront OAC ID for private bucket access"
  type        = string
  default     = ""
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for bucket policy"
  type        = string
  default     = ""
}

variable "account_id" {
  description = "AWS account ID for bucket policy"
  type        = string
  default     = ""
}

variable "create_assets_bucket" {
  description = "Create assets/media bucket"
  type        = bool
  default     = true
}

variable "create_logs_bucket" {
  description = "Create logs bucket"
  type        = bool
  default     = true
}

variable "create_app_data_bucket" {
  description = "Create private app data bucket"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log retention in days"
  type        = number
  default     = 90
}

variable "allowed_iam_principals" {
  description = "IAM principals allowed to access the invoices bucket"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
