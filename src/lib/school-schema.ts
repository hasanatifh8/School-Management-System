import { z } from "zod";
import { optionalEmail, optionalName, optionalPhone, optionalText } from "@/lib/action-state";

/** Optional year, from 1800 to this year. */
const optionalYear = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const year = Number(v);
    if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) {
      ctx.addIssue({ code: "custom", message: "Enter a year such as 1995" });
      return z.NEVER;
    }
    return year;
  });

/** A school's details as Power Admin enters them; school admins edit all but the code. */
export const schoolSchema = z.object({
  name: z.string().trim().min(2, "School name is required").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, "2–12 letters or digits, e.g. DPS or SVM01"),
  board: optionalText,
  principalName: optionalName("Principal"),
  schoolType: z
    .union([z.literal(""), z.enum(["PRIVATE", "GOVERNMENT", "SEMI_GOVERNMENT", "OTHER"])])
    .optional()
    .transform((v) => v || null),
  udiseCode: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{11}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "UDISE code is 11 digits" });
        return z.NEVER;
      }
      return v;
    }),
  affiliationNo: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  affiliationYear: optionalYear,
  establishedYear: optionalYear,
  motto: optionalText,
  address: optionalText,
  phone: optionalPhone,
  email: optionalEmail,
  website: z
    .union([z.literal(""), z.url({ message: "Enter a full address, e.g. https://school.edu.in" })])
    .optional()
    .transform((v) => v || null),
});
