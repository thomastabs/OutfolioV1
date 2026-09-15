-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('public', 'private', 'unlisted');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'private',

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "Profile_experienceYears_check" CHECK ("experienceYears" >= 0)
);

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
