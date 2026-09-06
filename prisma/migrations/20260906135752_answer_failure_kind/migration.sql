-- CreateEnum
CREATE TYPE "AnswerFailureKind" AS ENUM ('PERMANENT_REFUSAL', 'TRANSIENT');

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "failureKind" "AnswerFailureKind";

-- CreateIndex
CREATE INDEX "Answer_modelId_createdAt_idx" ON "Answer"("modelId", "createdAt");

