-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ItemVariant" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MenuItemModifier" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Modifier" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecipeLink" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serverReceivedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);
