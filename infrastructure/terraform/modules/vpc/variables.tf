/**
 * VPC Module Variables
 * 
 * Configuration variables for VPC creation with public/private subnets,
 * NAT gateways, and high availability setup.
 */

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && can(cidrnetmask(var.vpc_cidr))
    error_message = "Invalid CIDR block format"
  }
}

variable "availability_zones" {
  description = "List of availability zones for subnets"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "enable_single_nat_gateway" {
  description = "Use a single NAT gateway instead of one per AZ (cost optimization for dev)"
  type        = bool
  default     = false
}

variable "flow_log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.flow_log_retention_days >= 1 && var.flow_log_retention_days <= 365
    error_message = "Retention must be between 1 and 365 days"
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
