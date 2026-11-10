CREATE TABLE "Category" (
 "id" UUID NOT NULL,
 "name" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_name_case_insensitive_key" ON "Category"(LOWER("name"));
INSERT INTO "Category" (id,name)
SELECT gen_random_uuid(), name FROM (
 SELECT DISTINCT ON (LOWER(name)) name FROM (
  SELECT CASE WHEN TRIM(category) = '' THEN 'Sem categoria' ELSE TRIM(category) END AS name FROM "Book"
  UNION ALL SELECT UNNEST(ARRAY['Literatura','Ficção','Desenvolvimento pessoal','História','Design','Ciência','Tecnologia'])
 ) names ORDER BY LOWER(name),name
) canonical;
UPDATE "Book" b SET category=c.name FROM "Category" c WHERE LOWER(CASE WHEN TRIM(b.category) = '' THEN 'Sem categoria' ELSE TRIM(b.category) END)=LOWER(c.name);
ALTER TABLE "Book" ADD CONSTRAINT "Book_category_fkey" FOREIGN KEY (category) REFERENCES "Category"(name) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Book_category_deletedAt_idx" ON "Book"(category,"deletedAt");
