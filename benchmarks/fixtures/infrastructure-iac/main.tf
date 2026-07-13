terraform {
  required_version = ">= 1.7"
}

resource "aws_s3_bucket" "audit_state" {
  bucket = "audit-state-fixture"
}
