ALTER TABLE "Book" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'PHYSICAL', ADD COLUMN "readingUrl" TEXT, ADD COLUMN "source" TEXT, ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Book_externalId_key" ON "Book"("externalId");
CREATE TABLE "InboxNotification" (
 "id" UUID NOT NULL,
 "notificationId" UUID NOT NULL,
 "userId" UUID NOT NULL,
 "readAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InboxNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxNotification_notificationId_userId_key" ON "InboxNotification"("notificationId","userId");
CREATE INDEX "InboxNotification_userId_readAt_createdAt_idx" ON "InboxNotification"("userId","readAt","createdAt");
ALTER TABLE "InboxNotification" ADD CONSTRAINT "InboxNotification_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InboxNotification" ADD CONSTRAINT "InboxNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "InboxNotification" (id,"notificationId","userId") SELECT gen_random_uuid(), "notificationId", "userId" FROM "Delivery" GROUP BY "notificationId","userId";
