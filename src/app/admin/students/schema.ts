// Validation for student data, shared by the student form and the bulk importer.
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
import { normalizeDocumentNumber } from "@/lib/document-types";
import { MAX_STUDENT_AGE, MIN_STUDENT_AGE, RELIGIONS, dateOfBirthBounds, shiftYears } from "@/lib/student-options";

export const studentSchema = z
  .object({
    firstName: requiredName("First name"),
    middleName: optionalName("Middle name"),
    lastName: requiredName("Last name"),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = dateOfBirthBounds();
      const day = isoDate(d);
      if (day > todayISO()) {
        ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      } else if (day > max || day < min) {
        ctx.addIssue({
          code: "custom",
          message: `Student must be between ${MIN_STUDENT_AGE} and ${MAX_STUDENT_AGE} years old`,
        });
      }
    }),
    aadhaarNumber: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const result = normalizeDocumentNumber("AADHAAR", v ?? "");
        if ("error" in result) {
          ctx.addIssue({ code: "custom", message: result.error });
          return z.NEVER;
        }
        return result.value;
      }),
    category: z
      .enum(["GENERAL", "OBC", "SC_ST", "MINORITY", ""])
      .optional()
      .transform((v) => v || null),
    caste: optionalName("Caste"),
    religion: z
      .enum([...RELIGIONS, ""])
      .optional()
      .transform((v) => v || null),
    nationality: optionalName("Nationality"),
    email: optionalEmail,
    phone: optionalMobile,
    whatsappNumber: optionalMobile,
    whatsappSameAsPhone: z.literal("on").optional(),
    primaryAddress: optionalText,
    correspondenceAddress: optionalText,
    correspondenceSameAsPrimary: z.literal("on").optional(),
    lastSchoolName: optionalText,
    fatherName: optionalName("Father's name"),
    fatherOccupation: z.string().trim().max(100).optional().transform((v) => v || null),
    guardianName: optionalName("Guardian name"),
    guardianIsFather: z.literal("on").optional(),
    motherName: optionalName("Mother's name"),
    admissionDate: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const day = isoDate(d);
      if (day > todayISO()) ctx.addIssue({ code: "custom", message: "Admission date can't be in the future" });
      else if (day < shiftYears(todayISO(), -MAX_STUDENT_AGE)) {
        ctx.addIssue({ code: "custom", message: `Admission date can't be more than ${MAX_STUDENT_AGE} years ago` });
      }
    }),
    sectionId: optionalText,
    rollNumber: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 9999) {
          ctx.addIssue({ code: "custom", message: "Roll number must be a whole number from 1" });
          return z.NEVER;
        }
        return n;
      }),
    houseId: optionalText,
  })
  .transform(({ whatsappSameAsPhone, correspondenceSameAsPrimary, guardianIsFather, ...data }, ctx) => {
    if (guardianIsFather && !data.fatherName) {
      ctx.addIssue({ code: "custom", path: ["fatherName"], message: "Enter the father's name, or untick “Father is the guardian”" });
      return z.NEVER;
    }
    // A child is admitted at MIN_STUDENT_AGE at the earliest.
    if (data.dateOfBirth && data.admissionDate) {
      const earliest = shiftYears(isoDate(data.dateOfBirth), MIN_STUDENT_AGE);
      if (isoDate(data.admissionDate) < earliest) {
        ctx.addIssue({
          code: "custom",
          path: ["admissionDate"],
          message:
            data.admissionDate < data.dateOfBirth
              ? "Admission date can't be before the date of birth"
              : `Student must be at least ${MIN_STUDENT_AGE} years old on the admission date`,
        });
        return z.NEVER;
      }
    }
    // "Same as" checkboxes copy the other field.
    return {
      ...data,
      whatsappNumber: whatsappSameAsPhone ? data.phone : data.whatsappNumber,
      correspondenceAddress: correspondenceSameAsPrimary ? data.primaryAddress : data.correspondenceAddress,
      guardianName: guardianIsFather ? data.fatherName : data.guardianName,
    };
  });

export type StudentInput = z.infer<typeof studentSchema>;
