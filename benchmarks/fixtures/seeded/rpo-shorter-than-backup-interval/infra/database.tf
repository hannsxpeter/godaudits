terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

variable "region" {
  description = "Region that hosts orders-postgres and its backup vault."
  type        = string
  default     = "us-east-1"
}

variable "master_username" {
  description = "Master user for orders-postgres. The password is generated and rotated in Secrets Manager and is never written in this file."
  type        = string
  default     = "orders_admin"
}

provider "aws" {
  region = var.region
}

resource "aws_db_instance" "orders" {
  identifier                  = "orders-postgres"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = "db.t4g.medium"
  allocated_storage           = 250
  db_name                     = "orders"
  username                    = var.master_username
  manage_master_user_password = true
  storage_encrypted           = true
  publicly_accessible         = false
  backup_retention_period     = 0
  deletion_protection         = true
  skip_final_snapshot         = false
  final_snapshot_identifier   = "orders-postgres-final"
}

resource "aws_backup_vault" "orders" {
  name = "orders-postgres"
}

resource "aws_iam_role" "backup" {
  name = "orders-postgres-backup"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_plan" "orders" {
  name = "orders-postgres-snapshots"

  rule {
    rule_name         = "orders-recovery-point"
    target_vault_name = aws_backup_vault.orders.name
    schedule          = "cron(0 3 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = 30
    }
  }
}

resource "aws_backup_selection" "orders" {
  name         = "orders-postgres"
  plan_id      = aws_backup_plan.orders.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_db_instance.orders.arn]
}
