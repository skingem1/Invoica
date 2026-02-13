/**
 * S3 Module with Intelligent-Tiering
 * 
 * Creates S3 buckets with Intelligent-Tiering configuration,
 * versioning, encryption, and CloudFront integration.
 * 
 * @module s3
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
# S3 Bucket for Invoices with Intelligent-Tiering
# =============================================================================

resource "aws_s3_bucket" "invoices" {
  bucket = var.create_new_bucket ? "${var.bucket_prefix}-invoices-${var.environment}" : var.bucket_name
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-invoices-bucket"
      Environment = var.environment
    }
  )
}

resource "aws_s3_bucket_versioning" "invoices" {
  count = var.enable_versioning ? 1 : 0
  
  bucket = aws_s3_bucket.invoices.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.sse_algorithm
      kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : null
    }
  }
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "invoices" {
  count = var.enable_intelligent_tiering ? 1 : 0
  
  bucket = aws_s3_bucket.invoices.id
  name   = "invoice-archive-tiering"
  
  tiering {
    access_tier = "INTELLIGENT_TIERING"
    days        = 30
  }
  
  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
  
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
  
  filter {
    prefix = "invoices/"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "invoices" {
  count = var.enable_lifecycle_rules ? 1 : 0
  
  bucket = aws_s3_bucket.invoices.id
  
  rule {
    id     = "archive-old-invoices"
    status = "Enabled"
    
    filter {
      prefix = "invoices/"
    }
    
    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    
    expiration {
      days = var.lifecycle_expiration_days
    }
  }
  
  rule {
    id     = "abort-multipart-uploads"
    status = "Enabled"
    
    filter {
      prefix = "uploads/"
    }
    
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "invoices_cloudfront" {
  count = var.cloudfront_origin_access_control_id != "" ? 1 : 0
  
  bucket = aws_s3_bucket.invoices.id
  
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
        Resource = "${aws_s3_bucket.invoices.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn": "arn:aws:cloudfront::${var.account_id}:distribution/${var.cloudfront_distribution_id}"
          }
        }
      }
    ]
  })
}

# =============================================================================
# S3 Bucket for Assets/Media
# =============================================================================

resource "aws_s3_bucket" "assets" {
  count = var.create_assets_bucket ? 1 : 0
  
  bucket = "${var.bucket_prefix}-assets-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-assets-bucket"
      Environment = var.environment
    }
  )
}

resource "aws_s3_bucket_versioning" "assets" {
  count = var.create_assets_bucket && var.enable_versioning ? 1 : 0
  
  bucket = aws_s3_bucket.assets[0].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  count = var.create_assets_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.assets[0].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.sse_algorithm
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  count = var.create_assets_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.assets[0].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# S3 Bucket for Logs
# =============================================================================

resource "aws_s3_bucket" "logs" {
  count = var.create_logs_bucket ? 1 : 0
  
  bucket = "${var.bucket_prefix}-logs-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-logs-bucket"
      Environment = var.environment
      Type        = "logs"
    }
  )
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  count = var.create_logs_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.logs[0].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count = var.create_logs_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.logs[0].id
  
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    
    expiration {
      days = var.log_retention_days
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  count = var.create_logs_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.logs[0].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# S3 Bucket for Application Data (Private)
# =============================================================================

resource "aws_s3_bucket" "app_data" {
  count = var.create_app_data_bucket ? 1 : 0
  
  bucket = "${var.bucket_prefix}-app-data-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-app-data-bucket"
      Environment = var.environment
      Type        = "app-data"
    }
  )
}

resource "aws_s3_bucket_versioning" "app_data" {
  count = var.create_app_data_bucket && var.enable_versioning ? 1 : 0
  
  bucket = aws_s3_bucket.app_data[0].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app_data" {
  count = var.create_app_data_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.app_data[0].id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.sse_algorithm
      kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : null
    }
  }
}

resource "aws_s3_bucket_public_access_block" "app_data" {
  count = var.create_app_data_bucket ? 1 : 0
  
  bucket = aws_s3_bucket.app_data[0].id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "app_data" {
  count = var.create_app_data_bucket && var.enable_lifecycle_rules ? 1 : 0
  
  bucket = aws_s3_bucket.app_data[0].id
  
  rule {
    id     = "archive-old-data"
    status = "Enabled"
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# =============================================================================
# IAM Policy Documents for Cross-Account Access
# =============================================================================

data "aws_iam_policy_document" "invoices_access" {
  statement {
    sid = "AllowReadAccess"
    
    principals {
      type        = "AWS"
      identifiers = var.allowed_iam_principals
    }
    
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion"
    ]
    
    resources = [
      "${aws_s3_bucket.invoices.arn}/*"
    ]
  }
  
  statement {
    sid = "AllowListBucket"
    
    principals {
      type        = "AWS"
      identifiers = var.allowed_iam_principals
    }
    
    actions = [
      "s3:ListBucket"
    ]
    
    resources = [
      aws_s3_bucket.invoices.arn
    ]
  }
}

resource "aws_s3_bucket_policy" "invoices_access" {
  count = length(var.allowed_iam_principals) > 0 ? 1 : 0
  
  bucket = aws_s3_bucket.invoices.id
  policy = data.aws_iam_policy_document.invoices_access.json
}
