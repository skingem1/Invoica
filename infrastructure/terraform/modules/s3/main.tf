/**
 * S3 Bucket Module
 * 
 * Creates S3 buckets with:
 * - Intelligent-Tiering configuration for cost optimization
 * - Versioning enabled
 * - Encryption at rest
 * - CloudFront OAC integration for secure static asset delivery
 * 
 * @module s3
 * @requires hashicorp/aws >= 5.0
 */

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "bucket_name" {
  description = "Name of the S3 bucket (must be globally unique)"
  type        = string
}

variable "enable_intelligent_tiering" {
  description = "Enable S3 Intelligent-Tiering for cost optimization"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable versioning for the bucket"
  type        = bool
  default     = true
}

variable "enable_server_side_encryption" {
  description = "Enable server-side encryption"
  type        = bool
  default     = true
}

variable "sse_algorithm" {
  description = "Server-side encryption algorithm"
  type        = string
  default     = "AES256"
  validation {
    condition     = contains(["AES256", "aws:kms"], var.sse_algorithm)
    error_message = "SSE algorithm must be AES256 or aws:kms"
  }
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (use default AWS key if null)"
  type        = string
  default     = null
}

variable "lifecycle_rules" {
  description = "Lifecycle rules for the bucket"
  type = list(object({
    id     = string
    status = string
    filter = optional(object({
      prefix = string
      tags   = map(string)
    }), {})
    transition = optional(list(object({
      days          = number
      storage_class = string
    })), [])
    expiration = optional(number, null)
    noncurrent_version_expiration = optional(number, null)
  }))
  default = []
}

variable "enable_public_access_block" {
  description = "Block public access to the bucket"
  type        = bool
  default     = true
}

variable "allowed_bucket_actions" {
  description = "IAM actions allowed on the bucket (for bucket policies)"
  type        = list(string)
  default     = ["s3:GetObject"]
}

variable "cors_configuration" {
  description = "CORS configuration for the bucket"
  type = list(object({
    allowed_headers = list(string)
    allowed_methods = list(string)
    allowed_origins = list(string)
    expose_headers  = optional(list(string))
    max_age_seconds = optional(number)
  }))
  default = []
}

variable "logging_configuration" {
  description = "S3 access logging configuration"
  type = object({
    target_bucket = string
    target_prefix = optional(string, "logs/")
  })
  default = null
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

locals {
  common_tags = merge(
    {
      Environment = var.environment
      Project     = "infrastructure"
      ManagedBy   = "terraform"
    },
    var.tags
  )
  
  # Default Intelligent-Tiering rule if enabled and no lifecycle rules provided
  default_intelligent_tiering = var.enable_intelligent_tiering && length(var.lifecycle_rules) == 0 ? [
    {
      name                       = "intelligent-tiering-archive"
      status                     = "Enabled"
      filter = {
        prefix = ""
      }
      tiering = {
        "ARCHIVE_ACCESS" = 180
        "DEEP_ARCHIVE_ACCESS" = 365
      }
    }
  ] : []
}

# S3 Bucket
resource "aws_s3_bucket" "main" {
  bucket = var.bucket_name

  tags = local.common_tags
}

# Bucket Versioning
resource "aws_s3_bucket_versioning" "main" {
  count = var.enable_versioning ? 1 : 0

  bucket = aws_s3_bucket.main.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  count = var.enable_server_side_encryption ? 1 : 0

  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.sse_algorithm
      kms_master_key_id = var.kms_key_id
    }
  }
}

# Intelligent-Tiering Configuration
resource "aws_s3_bucket_intelligent_tiering_configuration" "main" {
  count = var.enable_intelligent_tiering ? 1 : 0

  bucket = aws_s3_bucket.main.id
  name   = "intelligent-tiering-config"

  # Use default configuration or provided lifecycle rules
  dynamic "tiering" {
    for_each = local.default_intelligent_tiering
    content {
      name                 = tiering.value.name
      status                = tiering.value.status
      access_tier_transition = lookup(tiering.value, "tiering", {})
    }
  }

  # Simplified tiering configuration
  dynamic "tiering" {
    for_each = var.enable_intelligent_tiering ? ["enabled"] : []
    content {
      name        = "Standard"
      status      = "Enabled"
      access_tier = ["ARCHIVE_ACCESS", "DEEP_ARCHIVE_ACCESS"]
    }
  }

  filter {
    prefix = ""
  }
}

# Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count = length(var.lifecycle_rules) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.status

      filter {
        prefix = lookup(rule.value.filter, "prefix", "")
        tags   = lookup(rule.value.filter, "tags", {})
      }

      dynamic "transition" {
        for_each = rule.value.transition
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      expiration {
        days = rule.value.expiration
      }

      noncurrent_version_expiration {
        noncurrent_days = rule.value.noncurrent_version_expiration
      }
    }
  }
}

# Public Access Block
resource "aws_s3_bucket_public_access_block" "main" {
  count = var.enable_public_access_block ? 1 : 0

  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls     = true
  restrict_public_buckets = true
}

# CORS Configuration
resource "aws_s3_bucket_cors_configuration" "main" {
  count = length(var.cors_configuration) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main.id

  dynamic "cors_rule" {
    for_each = var.cors_configuration
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

# Logging Configuration
resource "aws_s3_bucket_logging" "main" {
  count = var.logging_configuration != null ? 1 : 0

  bucket = aws_s3_bucket.main.id

  target_bucket = var.logging_configuration.target_bucket
  target_prefix = var.logging_configuration.target_prefix
}

# Bucket Policy (optional - for CloudFront OAC)
resource "aws_s3_bucket_policy" "main" {
  count = var.allowed_bucket_actions != null && length(var.allowed_bucket_actions) > 0 ? 1 : 0

  bucket = aws_s3_bucket.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.main.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${var.cloudfront_distribution_id != null ? var.cloudfront_distribution_id : ""}"
          }
        }
      }
    ]
  })
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for OAC (optional)"
  type        = string
  default     = null
}

data "aws_caller_identity" "current" {}

# Outputs
output "bucket_id" {
  description = "ID of the S3 bucket"
  value       = aws_s3_bucket.main.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.main.arn
}

output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket
}

output "bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}
