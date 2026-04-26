ALTER TABLE "Supplier"
ADD COLUMN "supplierCode" TEXT;

UPDATE "Supplier"
SET "supplierCode" = CASE "name"
  WHEN 'MiMarca' THEN 'MC'
  WHEN 'Terán Conde' THEN 'TC'
  WHEN 'Strambótica' THEN 'ST'
  WHEN 'Love By Ksenia' THEN 'LBK'
  WHEN 'Carmen Sánchez de Ventura' THEN 'CS'
  WHEN 'Nubla' THEN 'NB'
  WHEN 'Humberto Parra' THEN 'HP'
  WHEN 'Senda Tribe' THEN 'SETR'
  WHEN 'IS' THEN 'IS'
  WHEN 'Bold Woman' THEN 'BW'
  WHEN 'Fantoche' THEN 'FC'
  WHEN 'Mar Carlero' THEN 'MR'
  WHEN 'Gallo Buey' THEN 'GB'
  WHEN 'I Have A Dream' THEN 'IHD'
  WHEN 'Mirbama' THEN 'MI'
  WHEN 'Pauer Milano' THEN 'PP'
  WHEN 'Sonia Macías' THEN 'SM'
  WHEN 'Paloma Mantoncillos' THEN 'PM'
  WHEN 'Erika Design' THEN 'EH'
  WHEN 'Marga FBI' THEN 'MG'
  WHEN 'Alma Blanca' THEN 'AB'
  WHEN 'Sona' THEN 'MS'
  WHEN 'Marta en Brasil' THEN 'MB'
  WHEN 'Strena' THEN 'ME'
  WHEN 'Sorena' THEN 'SN'
  WHEN 'Emaná' THEN 'EM'
  WHEN 'One to One' THEN 'OM'
  WHEN 'Tantrend' THEN 'TT'
  WHEN 'Baba Desing' THEN 'BD'
  WHEN 'Eva Abanicos' THEN 'EA'
  WHEN 'Letdd' THEN 'LM'
  WHEN 'Silvina' THEN 'SI'
  WHEN 'Marao Flamenca' THEN 'MM'
  WHEN 'Código Vinario' THEN 'CV'
  WHEN 'Lola Pendientes' THEN 'LP'
  WHEN '3R' THEN '3R'
  ELSE NULL
END
WHERE "supplierCode" IS NULL;

CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
