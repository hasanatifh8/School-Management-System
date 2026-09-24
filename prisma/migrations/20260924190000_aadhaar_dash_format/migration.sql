-- Data only: show Aadhaar numbers as 1234-5678-9012 instead of 1234 5678 9012.
UPDATE "Student"
SET "aadhaarNumber" = regexp_replace("aadhaarNumber", '^(\d{4})\D?(\d{4})\D?(\d{4})$', '\1-\2-\3')
WHERE "aadhaarNumber" ~ '^\d{4}\D?\d{4}\D?\d{4}$';

UPDATE "Document"
SET "documentNumber" = regexp_replace("documentNumber", '^(\d{4})\D?(\d{4})\D?(\d{4})$', '\1-\2-\3')
WHERE "type" = 'AADHAAR' AND "documentNumber" ~ '^\d{4}\D?\d{4}\D?\d{4}$';
