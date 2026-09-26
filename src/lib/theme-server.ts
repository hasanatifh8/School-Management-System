import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/** The visitor's saved colour theme ("system" when none). */
export async function getTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
