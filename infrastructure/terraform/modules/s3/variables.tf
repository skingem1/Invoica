/**
 * S3 Module Variables
 * 
 * @module s3_variables
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "bucket_prefix" {
  description = "Prefix for bucket names"
  type        = string
  default     = "myapp"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# CloudFront Configuration
variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = true
}

variable "cloudfront_aliases" {
  description = "Aliases for CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "cloudfront_min_ttl" {
  description = "CloudFront minimum TTL in seconds"
  type        = number
  default     = 0
}

variable "cloudfront_default_ttl" {
  description = "CloudFront default TTL in seconds"
  type        = number
  default     = 3600
}

variable "cloudfront_max_ttl" {
  description = "CloudFront maximum TTL in seconds"
  type        = number
  default     = 86400
}

variable "cloudfront_origin_shield_region" {
  description = "CloudFront origin shield region"
  type        = string
  default     = "us-east-1"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_All"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront"
  type        = string
  default     = ""
}

variable "ssl_support_method" {
  description = "SSL support method (sni-only, vip)"
  type        = string
  default     = "sni-only"
}

variable "minimum_tls_version" {
  description = "Minimum TLS version (TLSv1.2_2021, TLSv1.2_2019, TLSv1.1_2016, TLSv1_2016)"
  type        = string
  default     = "TLSv1.2_2021"
}

variable "geo_restriction_type" {
  description = "Geo restriction type (none, whitelist, blacklist)"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "List of countries to allow/block"
  type        = list(string)
  default     = []
}

variable "custom_error_responses" {
  description = "Custom error responses configuration"
  type = list(object({
    error_code            = number
    error_caching_min_ttl = number
    response_code         = number
    response_page_path    = string
  }))
  default = [
    {
      error_code            = 403
      error_caching_min_ttl = 300
      response_code         = 403
      response_page_path    = "/error.html"
    },
    {
      error_code            = 404
      error_caching_min_ttl = 300
      response_code         = 404
      response_page_path    = "/error.html"
    }
  ]
}
