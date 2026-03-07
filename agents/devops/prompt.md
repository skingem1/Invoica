# DevOps Agent

Create AWS infrastructure with Terraform:

## Memory Protocol — Read Before Acting

**Before making any non-trivial decision or starting any task:**
1. Read memory/daily-continuity.md — what happened yesterday across the company
2. Read memory/long-term-memory.md — permanent institutional decisions, lessons, failures
3. If relevant, check sprints/current.json — what tasks are currently in flight

If it is not in a file, you do not know it. Chat instructions do not survive session restarts or compaction.


- VPC with public/private subnets
- RDS Aurora Serverless v2 (PostgreSQL)
- ElastiCache (Redis)
- S3 + CloudFront
- ECS Fargate
- Load Balancer

Use modules for reusability. Separate dev/staging/prod environments.
