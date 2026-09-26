// Validation for teacher data, shared by the teacher form and the bulk importer.
import { z } from "zod";
import {
  optionalBloodGroup,
  optionalDate,
  optionalEmail,
  optionalGender,
  optionalMobile,
  optionalName,
  optionalText,
  requiredName,
} from "@/lib/action-state";
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { MAX_TEACHER_AGE, MIN_TEACHER_AGE, ageBounds, shiftYears } from "@/lib/student-options";

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
    firstName: requiredName("First name"),
    middleName: optionalName("Middle name"),
    lastName: requiredName("Last name"),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = ageBounds(MIN_TEACHER_AGE, MAX_TEACHER_AGE);
      const day = isoDate(d);
      if (day > todayISO()) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      } else if (day > max || day < min) {
        ctx.addIssue({ code: "custom", message: `Teacher must be between ${MIN_TEACHER_AGE} and ${MAX_TEACHER_AGE} years old` });
      }
    }),
    email: optionalEmail,
    phone: optionalMobile,
    whatsappNumber: optionalMobile,
    whatsappSameAsPhone: z.literal("on").optional(),
    address: optionalText,
    qualification: optionalText,
    specialization: z.string().trim().max(100).optional().transform((v) => v || null),
    experienceYears: optionalWholeNumber("Experience", 0, 60),
    monthlySalary: optionalWholeNumber("Monthly salary", 0, 10_000_000),
    joiningDate: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const day = isoDate(d);
      if (day > todayISO()) ctx.addIssue({ code: "custom", message: "Joining date can't be in the future" });
      else if (day < shiftYears(todayISO(), MIN_TEACHER_AGE - MAX_TEACHER_AGE)) {
        ctx.addIssue({ code: "custom", message: `Joining date can't be more than ${MAX_TEACHER_AGE - MIN_TEACHER_AGE} years ago` });
      }
    }),
  })
  .transform(({ whatsappSameAsPhone, ...data }, ctx) => {
    if (data.dateOfBirth) {
      const dob = isoDate(data.dateOfBirth);
      if (data.joiningDate && isoDate(data.joiningDate) < shiftYears(dob, MIN_TEACHER_AGE)) {
        ctx.addIssue({
          code: "custom",
          path: ["joiningDate"],
          message: `Teacher must be at least ${MIN_TEACHER_AGE} years old on the joining date`,
        });
        return z.NEVER;
      }
      // Experience can only have started from MIN_TEACHER_AGE.
      const age = Number(todayISO().slice(0, 4)) - Number(dob.slice(0, 4)) - (todayISO().slice(5) < dob.slice(5) ? 1 : 0);
      const maxExperience = Math.max(0, age - MIN_TEACHER_AGE);
      if (data.experienceYears != null && data.experienceYears > maxExperience) {
        ctx.addIssue({
          code: "custom",
          path: ["experienceYears"],
          message: `Experience can't be more than ${maxExperience} year${maxExperience === 1 ? "" : "s"} for this date of birth`,
        });
        return z.NEVER;
      }
    }
    // "Same as phone" copies the phone number.
    return whatsappSameAsPhone ? { ...data, whatsappNumber: data.phone } : data;
  });

export type TeacherInput = z.infer<typeof teacherSchema>;
