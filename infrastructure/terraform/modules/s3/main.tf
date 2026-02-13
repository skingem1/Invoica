/**
 * S3 Module with CloudFront CDN
 * 
 * Creates S3 buckets with Intelligent-Tiering configuration,
 * including CloudFront distribution for CDN delivery.
 * 
 * @module s3
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
# S3 Bucket: Invoices (with Intelligent-Tiering)
################################################################################

resource "aws_s3_bucket" "invoices" {
  bucket = "${var.bucket_prefix}-invoices-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-invoices"
      Environment = var.environment
      Purpose     = "invoice-storage"
    }
  )
}

resource "aws_s3_bucket_versioning" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "AES256"
    }
  }
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "invoices" {
  name   = "invoice-archive"
  bucket = aws_s3_bucket.invoices.id
  
  tiering {
    name          = "archive-access"
    access_tier  = "ARCHIVE_ACCESS"
    days_after_initiation = 90
  }
  
  tiering {
    name          = "deep-archive"
    access_tier  = "DEEP_ARCHIVE_ACCESS"
    days_after_initiation = 180
  }
  
  filter {
    prefix = "invoices/"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
  
  rule {
    id     = "archive-invoices"
    status = "Enabled"
    
    filter {
      prefix = "archive/"
    }
    
    transition {
      storage_class = "GLACIER"
      days          = 90
    }
    
    transition {
      storage_class = "DEEP_ARCHIVE"
      days          = 365
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

resource "aws_s3_bucket_policy" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid = "DenyUnsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.invoices.arn,
          "${aws_s3_bucket.invoices.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

################################################################################
# S3 Bucket: Assets (for CloudFront distribution)
################################################################################

resource "aws_s3_bucket" "assets" {
  bucket = "${var.bucket_prefix}-assets-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-assets"
      Environment = var.environment
      Purpose     = "static-assets"
    }
  )
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  block_public_acls       = true
  block_block_public_policy = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

################################################################################
# S3 Bucket: Uploads (temporary upload bucket)
################################################################################

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.bucket_prefix}-uploads-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-uploads"
      Environment = var.environment
      Purpose     = "temp-uploads"
    }
  )
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  rule {
    id     = "expire-old-uploads"
    status = "Enabled"
    
    expiration {
      days = 7
    }
  }
}

################################################################################
# S3 Bucket: Logs
################################################################################

resource "aws_s3_bucket" "logs" {
  bucket = "${var.bucket_prefix}-logs-${var.environment}"
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-logs"
      Environment = var.environment
      Purpose     = "logging"
    }
  )
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "AES256"
    }
  }
}

# Enable access logging for other buckets
resource "aws_s3_bucket_logging" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "invoices/"
}

resource "aws_s3_bucket_logging" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "assets/"
}

################################################################################
# CloudFront Origin Access Control
################################################################################

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${var.environment}-assets-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                   = "sigv4"
}

################################################################################
# CloudFront Distribution
################################################################################

resource "aws_cloudfront_distribution" "assets" {
  count = var.enable_cloudfront ? 1 : 0
  
  enabled         = true
  is_ipv6_enabled = true
  comment        = "CloudFront distribution for ${var.environment} assets"
  
  aliases = var.cloudfront_aliases
  
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.id}"
    
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "match-viewer"
      origin_ssl_protocols   = ["TLSv1.2", "TLSv1.3"]
    }
  }
  
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.assets.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    min_ttl     = var.cloudfront_min_ttl
    default_ttl = var.cloudfront_default_ttl
    max_ttl     = var.cloudfront_max_ttl
    
    # Use origin shield for better caching
    origin_shield {
      enabled              = true
      origin_shield_region = var.cloudfront_origin_shield_region
    }
  }
  
  # Custom error responses
  dynamic "custom_error_response" {
    for_each = var.custom_error_responses
    content {
      error_code            = custom_error_response.value.error_code
      error_caching_min_ttl = custom_error_response.value.error_caching_min_ttl
      response_code         = custom_error_response.value.response_code
      response_page_path    = custom_error_response.value.response_page_path
    }
  }
  
  price_class = var.cloudfront_price_class
  
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }
  
  viewer_certificate {
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.ssl_support_method
    minimum_protocol_version       = var.minimum_tls_version
  }
  
  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/"
    include_cookies = false
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-cloudfront"
    }
  )
  
  depends_on = [aws_s3_bucket.assets]
}

################################################################################
# CloudFront Functions (for request/response manipulation)
################################################################################

resource "aws_cloudfront_function" "viewer_request" {
  count = var.enable_cloudfront ? 1 : 0
  
  name    = "${var.environment}-viewer-request"
  runtime = "cloudfront-js-1.0"
  comment = "Viewer request function for ${var.environment}"
  
  code = <<EOF
function handler(event) {
  var request = event.request;
  
  // Add security headers
  request.headers['x-forwarded-for'] = { value: event.viewerIp };
  
  return request;
}
EOF
}

resource "aws_cloudfront_function" "viewer_response" {
  count = var.enable_cloudfront ? 1 : 0
  
  name    = "${var.environment}-viewer-response"
  runtime = "cloudfront-js-1.0"
  comment = "Viewer response function for ${var.environment}"
  
  code = <<EOF
function handler(event) {
  var response = event.response;
  
  // Add security headers
  response.headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubDomains' };
  response.headers['x-content-type-options'] = { value: 'nosniff' };
  response.headers['x-frame-options'] = { value: 'DENY' };
  response.headers['x-xss-protection'] = { value: '1; mode=block' };
  
  return response;
}
EOF
}

################################################################################
# Outputs
################################################################################

output "invoices_bucket_name" {
  description = "Name of the invoices S3 bucket"
  value       = aws_s3_bucket.invoices.id
}

output "invoices_bucket_arn" {
  description = "ARN of the invoices S3 bucket"
  value       = aws_s3_bucket.invoices.arn
}

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  description = "ARN of the assets S3 bucket"
  value       = aws_s3_bucket.assets.arn
}

output "uploads_bucket_name" {
  description = "Name of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.arn
}

output "logs_bucket_name" {
  description = "Name of the logs S3 bucket"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "ARN of the logs S3 bucket"
  value       = aws_s3_bucket.logs.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].id : ""
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].domain_name : ""
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].arn : ""
}
