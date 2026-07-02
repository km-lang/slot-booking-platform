-- Add MentorProfile.pgpId (mirrors StudentProfile.pgpId) and normalize the
-- ID format so every stored value already carries its own prefix (PGP.../ABM...),
-- matching how the ID appears in the person's @iiml.ac.in email local-part.

-- 1. Add the column nullable first so existing rows don't violate NOT NULL.
ALTER TABLE "MentorProfile" ADD COLUMN "pgpId" TEXT;

-- 2. Backfill MentorProfile.pgpId from each mentor's email local-part, uppercased
--    (e.g. abm22011@iiml.ac.in -> ABM22011, pgp41259@iiml.ac.in -> PGP41259).
UPDATE "MentorProfile" mp
SET "pgpId" = UPPER(split_part(u."email", '@', 1))
FROM "User" u
WHERE mp."userId" = u."id";

-- 3. Lock down MentorProfile.pgpId now that every row has a value.
ALTER TABLE "MentorProfile" ALTER COLUMN "pgpId" SET NOT NULL;
CREATE UNIQUE INDEX "MentorProfile_pgpId_key" ON "MentorProfile"("pgpId");

-- 4. Normalize StudentProfile.pgpId: values that start with a digit (plain
--    "42287" or repeater-suffixed "41013R") get a PGP prefix. Values that
--    already start with a letter (e.g. "ABM23017", "ABM22052R") are left as-is.
UPDATE "StudentProfile"
SET "pgpId" = 'PGP' || "pgpId"
WHERE "pgpId" ~ '^[0-9]';
