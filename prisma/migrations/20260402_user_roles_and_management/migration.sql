ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'SUPERUSER');

ALTER TABLE "User"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole"
USING (
  CASE
    WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole"
    ELSE 'ADMIN'::"UserRole"
  END
);

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'ADMIN';

DROP TYPE "UserRole_old";

UPDATE "User"
SET "role" = 'SUPERADMIN'
WHERE lower("email") = 'kevin.luis.beaumont@gmail.com';
