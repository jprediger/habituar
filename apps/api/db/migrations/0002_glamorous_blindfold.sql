CREATE TYPE "public"."role_environment" AS ENUM('student', 'professional', 'monitor');--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "environment" "role_environment";