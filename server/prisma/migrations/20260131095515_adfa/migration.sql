-- CreateTable
CREATE TABLE "ChatPinnedMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPinnedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatPinnedMessage_conversationId_idx" ON "ChatPinnedMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatPinnedMessage_pinnedBy_idx" ON "ChatPinnedMessage"("pinnedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPinnedMessage_conversationId_messageId_key" ON "ChatPinnedMessage"("conversationId", "messageId");

-- AddForeignKey
ALTER TABLE "ChatPinnedMessage" ADD CONSTRAINT "ChatPinnedMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPinnedMessage" ADD CONSTRAINT "ChatPinnedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPinnedMessage" ADD CONSTRAINT "ChatPinnedMessage_pinnedBy_fkey" FOREIGN KEY ("pinnedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
