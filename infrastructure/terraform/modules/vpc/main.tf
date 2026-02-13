/**
 * VPC Module
 * 
 * Creates a VPC with public and private subnets across multiple availability zones.
 * Includes NAT Gateways for private subnet internet access.
 * 
 * @module vpc
 * @requires terraform-aws-modules/vpc/aws >= 5.0
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

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for all private subnets (cost optimization)"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in VPC"
  type        = bool
  default     = true
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
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "${var.environment}-vpc"

  cidr            = var.vpc_cidr
  azs             = var.availability_zones
  public_subnets  = var.public_subnet_cidrs
  private_subnets = var.private_subnet_cidrs

  # Database subnets - separate for RDS and ElastiCache
  database_subnets                   = var.database_subnet_cidrs
  create_database_subnet_group       = true
  create_database_subnet_route_table = true

  # NAT Gateway configuration
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway

  # DNS Configuration
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support

  # Tags
  tags = local.common_tags

  # Additional tag for public subnets
  public_subnet_tags = {
    Type = "public"
  }

  # Additional tag for private subnets
  private_subnet_tags = {
    Type = "private"
  }

  # Additional tag for database subnets
  database_subnet_tags = {
    Type = "database"
  }
}

# Security Group for NAT Gateway (if needed)
resource "aws_security_group" "nat_gateway" {
  name        = "${var.environment}-nat-sg"
  description = "Security group for NAT Gateway"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = module.vpc.database_subnet_ids
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = module.vpc.public_route_table_id
}

output "private_route_table_ids" {
  description = "IDs of the private route tables"
  value       = module.vpc.private_route_table_ids
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = module.vpc.nat_gateway_ids
}

output "nat_gateway_ips" {
  description = "Elastic IPs of the NAT Gateways"
  value       = module.vpc.nat_gateway_public_ips
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = module.vpc.igw_id
}

output "database_subnet_group_id" {
  description = "ID of the database subnet group"
  value       = module.vpc.database_subnet_group_id
}

output "security_group_nat_id" {
  description = "ID of the NAT Gateway security group"
  value       = aws_security_group.nat_gateway.id
}
