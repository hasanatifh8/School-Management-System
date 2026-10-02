// Validation for non-teaching staff profiles (same rules as teachers where they overlap).
import { z } from "zod";
import {
  optionalBloodGroup,
  optionalDate,
  optionalEmail,
  optionalGender,
  optionalMobile,
  optionalText,
  requiredName,
} from "@/lib/action-state";
import { isoDate, todayISO } from "@/lib/attendance-shared";
import { MAX_TEACHER_AGE as MAX_AGE, MIN_TEACHER_AGE as MIN_AGE, ageBounds, shiftYears } from "@/lib/student-options";

export { MAX_AGE as MAX_STAFF_AGE, MIN_AGE as MIN_STAFF_AGE };

/** Common jobs, offered as suggestions. */
export const STAFF_DEPARTMENTS = ["Administration", "Accounts", "Front office", "Library", "Laboratory", "Transport", "Maintenance", "Housekeeping", "Security", "Kitchen", "Medical"];
export const STAFF_JOBS = ["Cashier", "Accountant", "Office assistant", "Receptionist", "Librarian", "Lab assistant", "Security guard", "Peon", "Helper", "Cleaner", "Driver", "Conductor", "Gardener", "Cook", "Nurse", "Electrician"];

/** Optional whole number within a range; accepts "12,000" and "₹12000". */
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

export const staffSchema = z
  .object({
    name: requiredName("Full name").refine((v) => v.length >= 2, "Enter the full name"),
    designation: z.string().trim().min(2, "Enter the job, e.g. Security guard").max(60, "Job is too long"),
    department: z.string().trim().max(60, "Department is too long").optional().transform((v) => v || null),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = ageBounds(MIN_AGE, MAX_AGE);
      const day = isoDate(d);
      if (day > todayISO()) ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      else if (day > max || day < min) ctx.addIssue({ code: "custom", message: `Staff must be between ${MIN_AGE} and ${MAX_AGE} years old` });
    }),
    email: optionalEmail,
    phone: optionalMobile,
    whatsappNumber: optionalMobile,
    whatsappSameAsPhone: z.literal("on").optional(),
    address: optionalText,
    qualification: z.string().trim().max(100).optional().transform((v) => v || null),
    experienceYears: optionalWholeNumber("Experience", 0, 60),
    monthlySalary: optionalWholeNumber("Monthly salary", 0, 10_000_000),
    joiningDate: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const day = isoDate(d);
      if (day > todayISO()) ctx.addIssue({ code: "custom", message: "Joining date can't be in the future" });
      else if (day < shiftYears(todayISO(), MIN_AGE - MAX_AGE)) {
        ctx.addIssue({ code: "custom", message: `Joining date can't be more than ${MAX_AGE - MIN_AGE} years ago` });
      }
    }),
  })
  .transform(({ whatsappSameAsPhone, ...data }, ctx) => {
    if (data.dateOfBirth && data.joiningDate && isoDate(data.joiningDate) < shiftYears(isoDate(data.dateOfBirth), MIN_AGE)) {
      ctx.addIssue({ code: "custom", path: ["joiningDate"], message: `Staff must be at least ${MIN_AGE} years old on the joining date` });
      return z.NEVER;
    }
    // "Same as phone" copies the phone number.
    return whatsappSameAsPhone ? { ...data, whatsappNumber: data.phone } : data;
  });

export type StaffInput = z.infer<typeof staffSchema>;
