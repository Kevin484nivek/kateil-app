ALTER TABLE "ProductSubtype" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Season" ADD COLUMN "categoryId" TEXT;

UPDATE "ProductSubtype" ps
SET "categoryId" = source."categoryId"
FROM (
  SELECT DISTINCT ON (p."productSubtypeId")
    p."productSubtypeId" AS id,
    p."categoryId"
  FROM "Product" p
  WHERE p."productSubtypeId" IS NOT NULL
  ORDER BY p."productSubtypeId", p."createdAt" ASC
) AS source
WHERE ps."id" = source.id;

UPDATE "Season" s
SET "categoryId" = source."categoryId"
FROM (
  SELECT DISTINCT ON (p."seasonId")
    p."seasonId" AS id,
    p."categoryId"
  FROM "Product" p
  WHERE p."seasonId" IS NOT NULL
  ORDER BY p."seasonId", p."createdAt" ASC
) AS source
WHERE s."id" = source.id;

UPDATE "ProductSubtype"
SET "categoryId" = (
  SELECT c."id"
  FROM "Category" c
  WHERE c."name" = 'Ropa'
  ORDER BY c."createdAt" ASC
  LIMIT 1
)
WHERE "categoryId" IS NULL
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."name" = 'Ropa');

UPDATE "Season"
SET "categoryId" = (
  SELECT c."id"
  FROM "Category" c
  WHERE c."name" = 'Ropa'
  ORDER BY c."createdAt" ASC
  LIMIT 1
)
WHERE "categoryId" IS NULL
  AND EXISTS (SELECT 1 FROM "Category" c WHERE c."name" = 'Ropa');

UPDATE "ProductSubtype"
SET "categoryId" = (
  SELECT c."id"
  FROM "Category" c
  ORDER BY c."createdAt" ASC
  LIMIT 1
)
WHERE "categoryId" IS NULL;

UPDATE "Season"
SET "categoryId" = (
  SELECT c."id"
  FROM "Category" c
  ORDER BY c."createdAt" ASC
  LIMIT 1
)
WHERE "categoryId" IS NULL;

ALTER TABLE "ProductSubtype" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Season" ALTER COLUMN "categoryId" SET NOT NULL;

DROP INDEX "ProductSubtype_name_key";
DROP INDEX "Season_name_key";

CREATE UNIQUE INDEX "ProductSubtype_categoryId_name_key" ON "ProductSubtype"("categoryId", "name");
CREATE UNIQUE INDEX "Season_categoryId_name_key" ON "Season"("categoryId", "name");

ALTER TABLE "ProductSubtype"
ADD CONSTRAINT "ProductSubtype_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Season"
ADD CONSTRAINT "Season_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
