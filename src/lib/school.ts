import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * The school the current request operates on.
 *
 * TODO(auth): there is no login yet, so this returns the first school.
 * Once authentication is added, resolve the school from the signed-in
 * admin's session and reject requests from anyone who is not an admin.
 * Every admin page and server action already goes through this function,
 * so that check only has to be added here.
 */
export const getCurrentSchool = cache(async () => {
  const school = await db.school.findFirst({ orderBy: { createdAt: "asc" } });
  if (!school) {
    throw new Error("No school found. Run `npm run db:seed` to create one.");
  }
  return school;
});
