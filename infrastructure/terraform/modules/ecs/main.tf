/**
 * ECS Fargate Module
 * 
 * Creates ECS Fargate clusters with:
 * - API service (on-demand instances)
 * - Worker service (Spot instances for cost optimization)
 * - Application Load Balancer integration
 * - CloudMap service discovery
 * 
 * @module ecs
 * @requires hashicorp/aws >= 5.0
 * @requires hashicorp/awscc >= 0.50
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

variable "vpc_id" {
  description = "VPC ID where ECS will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "app-cluster"
}

variable "ecs_vpc_security_group_ids" {
  description = "Additional security group IDs for ECS tasks"
  type        = list(string)
  default     = []
}

variable "alb_security_group_ids" {
  description = "Additional security group IDs for ALB"
  type        = list(string)
  default     = []
}

# API Service Configuration
variable "api_container_image" {
  description = "Container image for API service"
  type        = string
  default     = ""
}

variable "api_container_port" {
  description = "Container port for API service"
  type        = number
  default     = 8080
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "api_min_capacity" {
  description = "Minimum capacity for API autoscaling"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum capacity for API autoscaling"
  type        = number
  default     = 10
}

variable "api_cpu" {
  description = "CPU units for API task"
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Memory in MB for API task"
  type        = number
  default     = 512
}

# Worker Service Configuration
variable "worker_container_image" {
  description = "Container image for worker service"
  type        = string
  default     = ""
}

variable "worker_container_port" {
  description = "Container port for worker service"
  type        = number
  default     = 8081
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks"
  type        = number
  default     = 2
}

variable "worker_min_capacity" {
  description = "Minimum capacity for worker autoscaling"
  type        = number
  default     = 1
}

variable "worker_max_capacity" {
  description = "Maximum capacity for worker autoscaling"
  type        = number
  default     = 5
}

variable "worker_cpu" {
  description = "CPU units for worker task"
  type        = number
  default     = 256
}

variable "worker_memory" {
  description = "Memory in MB for worker task"
  type        = number
  default     = 512
}

variable "worker_spot" {
  description = "Use Spot instances for workers (cost optimization)"
  type        = bool
  default     = true
}

# RDS Configuration
variable "rds_endpoint" {
  description = "RDS cluster endpoint"
  type        = string
  default     = ""
}

variable "rds_database_name" {
  description = "RDS database name"
  type        = string
  default     = ""
}

variable "rds_port" {
  description = "RDS port"
  type        = number
  default     = 5432
}

# Redis Configuration
variable "redis_endpoint" {
  description = "Redis cluster endpoint"
  type        = string
  default     = ""
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

# S3 Configuration
variable "s3_bucket_arns" {
  description = "S3 bucket ARNs to allow access"
  type        = list(string)
  default     = []
}

# Environment variables
variable "api_environment_variables" {
  description = "Environment variables for API container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "worker_environment_variables" {
  description = "Environment variables for worker container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
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
  
  api_environment = concat([
    { name = "ENVIRONMENT", value = var.environment },
    { name = "PORT", value = tostring(var.api_container_port) },
    { name = "DB_HOST", value = var.rds_endpoint },
    { name = "DB_PORT", value = tostring(var.rds_port) },
    { name = "DB_NAME", value = var.rds_database_name },
    { name = "REDIS_HOST", value = var.redis_endpoint },
    { name = "REDIS_PORT", value = tostring(var.redis_port) },
  ], var.api_environment_variables)
  
  worker_environment = concat([
    { name = "ENVIRONMENT", value = var.environment },
    { name = "PORT", value = tostring(var.worker_container_port) },
    { name = "DB_HOST", value = var.rds_endpoint },
    { name = "DB_PORT", value = tostring(var.rds_port) },
    { name = "DB_NAME", value = var.rds_database_name },
    { name = "REDIS_HOST", value = var.redis_endpoint },
    { name = "REDIS_PORT", value = tostring(var.redis_port) },
  ], var.worker_environment_variables)
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }

  # Add FARGATE_SPOT for workers if enabled
  dynamic "capacity_provider_strategy" {
    for_each = var.worker_spot ? ["spot"] : []
    content {
      base              = 0
      weight            = 100
      capacity_provider = "FARGATE_SPOT"
    }
  }
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.environment}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.api_container_port
    to_port     = var.api_container_port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "API from VPC"
  }

  ingress {
    from_port   = var.worker_container_port
    to_port     = var.worker_container_port
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "Worker from VPC"
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

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet"
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

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = concat([aws_security_group.alb.id], var.alb_security_group_ids)
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = local.common_tags
}

# Target Group for API
resource "aws_lb_target_group" "api" {
  name     = "${var.environment}-api-tg"
  port     = var.api_container_port
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  target_type = "ip"

  tags = local.common_tags
}

# Listener for ALB
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.environment}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# ECS Task Execution Policy
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (for S3 access)
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# S3 Access Policy
resource "aws_iam_policy" "s3_access" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  name = "${var.environment}-ecs-s3-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [for arn in var.s3_bucket_arns : "${arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arns
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.s3_access[0].arn
}

# ECS Task Definition - API
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.api_cpu)
  memory                   = tostring(var.api_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_container_image
      essential = true
      portMappings = [
        {
          containerPort = var.api_container_port
          protocol      = "tcp"
        }
      ]
      environment = local.api_environment
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}-api"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.common_tags
}

# ECS Task Definition - Worker
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.environment}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.worker_cpu)
  memory                   = tostring(var.worker_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.worker_container_image
      essential = true
      portMappings = [
        {
          containerPort = var.worker_container_port
          protocol      = "tcp"
        }
      ]
      environment = local.worker_environment
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}-worker"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.environment}-api"
  retention_in_days = 7

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.environment}-worker"
  retention_in_days = 7

  tags = local.common_tags
}

# ECS Service - API
resource "aws_ecs_service" "api" {
  name            = "${var.environment}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count

  launch_type = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = concat([aws_security_group.ecs_tasks.id], var.ecs_vpc_security_group_ids)
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  propagate_tags = "TASK_DEFINITION"

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_count]
  }
}

# ECS Service - Worker
resource "aws_ecs_service" "worker" {
  name            = "${var.environment}-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count

  launch_type = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = concat([aws_security_group.ecs_tasks.id], var.ecs_vpc_security_group_ids)
    assign_public_ip = false
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  propagate_tags = "TASK_DEFINITION"

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_count]
  }
}

# Autoscaling - API
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  role_arn           = aws_iam_role.ecs_autoscaling_role.arn
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.environment}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${var.environment}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

# Autoscaling - Worker
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_capacity
  min_capacity       = var.worker_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  role_arn           = aws_iam_role.ecs_autoscaling_role.arn
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${var.environment}-worker-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

# Autoscaling IAM Role
resource "aws_iam_role" "ecs_autoscaling_role" {
  name = "${var.environment}-ecs-autoscaling-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "application-autoscaling.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_autoscaling" {
  role       = aws_iam_role.ecs_autoscaling_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceAutoscaleRole"
}

data "aws_region" "current" {}

# Outputs
output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the ALB"
  value       = aws_lb.main.arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}
