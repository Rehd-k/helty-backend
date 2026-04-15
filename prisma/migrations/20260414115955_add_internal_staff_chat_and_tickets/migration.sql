-- CreateEnum
CREATE TYPE "StaffConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "StaffConversationMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "StaffConversationMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportTicketAuditAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'MESSAGE_ADDED', 'TITLE_CHANGED');

-- CreateTable
CREATE TABLE "StaffConversation" (
    "id" TEXT NOT NULL,
    "type" "StaffConversationType" NOT NULL,
    "name" TEXT,
    "directKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "StaffConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "type" "StaffConversationMessageType" NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffConversationMessageRead" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffConversationMessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketAuditLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" "SupportTicketAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffConversation_directKey_key" ON "StaffConversation"("directKey");

-- CreateIndex
CREATE INDEX "StaffConversation_type_idx" ON "StaffConversation"("type");

-- CreateIndex
CREATE INDEX "StaffConversationMember_staffId_idx" ON "StaffConversationMember"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffConversationMember_conversationId_staffId_key" ON "StaffConversationMember"("conversationId", "staffId");

-- CreateIndex
CREATE INDEX "StaffConversationMessage_conversationId_createdAt_id_idx" ON "StaffConversationMessage"("conversationId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "StaffConversationMessageRead_staffId_idx" ON "StaffConversationMessageRead"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffConversationMessageRead_messageId_staffId_key" ON "StaffConversationMessageRead"("messageId", "staffId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

-- CreateIndex
CREATE INDEX "SupportTicketAssignment_staffId_idx" ON "SupportTicketAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicketAssignment_ticketId_staffId_key" ON "SupportTicketAssignment"("ticketId", "staffId");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketAuditLog_ticketId_createdAt_idx" ON "SupportTicketAuditLog"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffConversationMember" ADD CONSTRAINT "StaffConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StaffConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationMember" ADD CONSTRAINT "StaffConversationMember_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationMessage" ADD CONSTRAINT "StaffConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StaffConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationMessage" ADD CONSTRAINT "StaffConversationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationMessageRead" ADD CONSTRAINT "StaffConversationMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "StaffConversationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffConversationMessageRead" ADD CONSTRAINT "StaffConversationMessageRead_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAssignment" ADD CONSTRAINT "SupportTicketAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAssignment" ADD CONSTRAINT "SupportTicketAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAssignment" ADD CONSTRAINT "SupportTicketAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAuditLog" ADD CONSTRAINT "SupportTicketAuditLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketAuditLog" ADD CONSTRAINT "SupportTicketAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
