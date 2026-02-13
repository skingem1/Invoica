/**
 * VPC Module
 * 
 * Creates a VPC with public and private subnets, NAT Gateway,
 * and route tables for high availability across multiple AZs.
 * 
 * @module vpc
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
# VPC Configuration
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpc"
    }
  )
}

# =============================================================================
# Internet Gateway
# =============================================================================

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-igw"
    }
  )
}

# =============================================================================
# Public Subnets
# =============================================================================

resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]
  
  map_public_ip_on_launch = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-public-subnet-${count.index + 1}"
      Type = "public"
    }
  )
}

# =============================================================================
# Private Application Subnets
# =============================================================================

resource "aws_subnet" "private_app" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-private-app-subnet-${count.index + 1}"
      Type = "private_app"
    }
  )
}

# =============================================================================
# Private Database Subnets
# =============================================================================

resource "aws_subnet" "private_db" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + (length(var.availability_zones) * 2))
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-private-db-subnet-${count.index + 1}"
      Type = "private_db"
    }
  )
}

# =============================================================================
# NAT Gateway EIPs and Gateways (one per AZ for high availability)
# =============================================================================

resource "aws_eip" "nat" {
  count  = var.enable_single_nat_gateway ? 1 : length(var.availability_zones)
  domain = "vpc"
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-nat-eip-${count.index + 1}"
    }
  )
  
  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_single_nat_gateway ? 1 : length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-nat-gw-${count.index + 1}"
    }
  )
  
  depends_on = [aws_internet_gateway.main]
}

# =============================================================================
# Public Route Table
# =============================================================================

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-public-rt"
    }
  )
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# Private Route Tables (one per NAT Gateway for HA)
# =============================================================================

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[var.enable_single_nat_gateway ? 0 : count.index].id
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-private-rt-${count.index + 1}"
    }
  )
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private[var.enable_single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "private_db" {
  count          = length(aws_subnet.private_db)
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private[var.enable_single_nat_gateway ? 0 : count.index].id
}

# =============================================================================
# Database Subnet Group
# =============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.environment}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-db-subnet-group"
    }
  )
}

# =============================================================================
# Security Group for VPC endpoints
# =============================================================================

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.environment}-vpc-endpoints-sg"
  description = "Security group for VPC endpoints"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from within VPC"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpc-endpoints-sg"
    }
  )
}

# =============================================================================
# VPC Endpoints (S3, Secrets Manager, SSM)
# =============================================================================

resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.s3"
  
  route_table_ids = concat(
    [aws_route_table.public.id],
    aws_route_table.private[*].id
  )
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpce-s3"
    }
  )
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.secretsmanager"
  
  vpc_endpoint_type = "Interface"
  
  subnet_ids = aws_subnet.private_app[*].id
  
  security_group_ids = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpce-secretsmanager"
    }
  )
}

resource "aws_vpc_endpoint" "ssm" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.ssm"
  
  vpc_endpoint_type = "Interface"
  
  subnet_ids = aws_subnet.private_app[*].id
  
  security_group_ids = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpce-ssm"
    }
  )
}

resource "aws_vpc_endpoint" "ssm_messages" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.ssm-messages"
  
  vpc_endpoint_type = "Interface"
  
  subnet_ids = aws_subnet.private_app[*].id
  
  security_group_ids = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpce-ssm-messages"
    }
  )
}

resource "aws_vpc_endpoint" "ec2messages" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.ec2messages"
  
  vpc_endpoint_type = "Interface"
  
  subnet_ids = aws_subnet.private_app[*].id
  
  security_group_ids = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpce-ec2messages"
    }
  )
}

# =============================================================================
# Flow Logs
# =============================================================================

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flow-logs/${var.environment}"
  retention_in_days = var.flow_log_retention_days
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-vpc-flow-logs"
    }
  )
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.environment}-vpc-flow-logs-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "vpc_flow_logs" {
  name = "${var.environment}-vpc-flow-logs-policy"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "vpc_flow_logs" {
  role       = aws_iam_role.vpc_flow_logs.name
  policy_arn = aws_iam_policy.vpc_flow_logs.arn
}

resource "aws_flow_log" "main" {
  log_destination      = aws_cloudwatch_log_group.vpc_flow_logs.arn
  log_destination_type = "cloud-watch-logs"
  traffic_type         = "ALL"
  vpc_id               = aws_vpc.main.id
  
  iam_role_arn = aws_iam_role.vpc_flow_logs.arn
  
  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-flow-log"
    }
  )
}
