CREATE TABLE "ProductSubtype" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubtype_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product"
ADD COLUMN "productSubtypeId" TEXT,
ADD COLUMN "seasonId" TEXT;

CREATE UNIQUE INDEX "ProductSubtype_name_key" ON "ProductSubtype"("name");
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_productSubtypeId_fkey"
FOREIGN KEY ("productSubtypeId") REFERENCES "ProductSubtype"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
