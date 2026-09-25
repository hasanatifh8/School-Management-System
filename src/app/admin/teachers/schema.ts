// Validation for teacher data, shared by the teacher form and the bulk importer.
import { z } from "zod";
import { optionalBloodGroup, optionalDate, optionalGender, optionalText, requiredText } from "@/lib/action-state";
import { MAX_TEACHER_AGE, MIN_TEACHER_AGE, ageBounds, normalizeIndianMobile } from "@/lib/student-options";

/** Optional whole number within a range; accepts "45,000" and "₹45000". */
const optionalWholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const raw = (v ?? "").replace(/[,\s₹]/g, "");
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min.toLocaleString("en-IN")} to ${max.toLocaleString("en-IN")}` });
        return z.NEVER;
      }
      return n;
    });

export const teacherSchema = z
  .object({
    firstName: requiredText("First name"),
    middleName: optionalText,
    lastName: requiredText("Last name"),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = ageBounds(MIN_TEACHER_AGE, MAX_TEACHER_AGE);
      const day = d.toISOString().slice(0, 10);
      if (day > new Date().toISOString().slice(0, 10)) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      } else if (day > max || day < min) {
        ctx.addIssue({ code: "custom", message: `Teacher must be between ${MIN_TEACHER_AGE} and ${MAX_TEACHER_AGE} years old` });
      }
    }),
    email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
    phone: optionalText,
    whatsappNumber: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const mobile = normalizeIndianMobile(v);
        if (!mobile) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
        return mobile ?? z.NEVER;
      }),
    whatsappSameAsPhone: z.literal("on").optional(),
    address: optionalText,
    qualification: optionalText,
    specialization: z.string().trim().max(100).optional().transform((v) => v || null),
    experienceYears: optionalWholeNumber("Experience", 0, 60),
    monthlySalary: optionalWholeNumber("Monthly salary", 0, 10_000_000),
    joiningDate: optionalDate,
  })
  .transform(({ whatsappSameAsPhone, ...data }, ctx) => {
    // "Same as phone" copies the phone number.
    if (!whatsappSameAsPhone) return data;
    const whatsappNumber = data.phone ? normalizeIndianMobile(data.phone) : null;
    if (data.phone && !whatsappNumber) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid 10-digit mobile number to use it for WhatsApp" });
      return z.NEVER;
    }
    return { ...data, whatsappNumber };
  });

export type TeacherInput = z.infer<typeof teacherSchema>;
