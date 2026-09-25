// Validation for student data, shared by the student form and the bulk importer.
import { z } from "zod";
import { optionalBloodGroup, optionalDate, optionalGender, optionalText, requiredText } from "@/lib/action-state";
import { normalizeDocumentNumber } from "@/lib/document-types";
import {
  MAX_STUDENT_AGE,
  MIN_STUDENT_AGE,
  RELIGIONS,
  dateOfBirthBounds,
  normalizeIndianMobile,
} from "@/lib/student-options";

const dobBounds = () => dateOfBirthBounds();

export const studentSchema = z
  .object({
    firstName: requiredText("First name"),
    middleName: optionalText,
    lastName: requiredText("Last name"),
    gender: optionalGender,
    bloodGroup: optionalBloodGroup,
    dateOfBirth: optionalDate.superRefine((d, ctx) => {
      if (!d) return;
      const { min, max } = dobBounds();
      const day = d.toISOString().slice(0, 10);
      if (day > new Date().toISOString().slice(0, 10)) {
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
    caste: optionalText,
    religion: z
      .enum([...RELIGIONS, ""])
      .optional()
      .transform((v) => v || null),
    nationality: optionalText,
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
    primaryAddress: optionalText,
    correspondenceAddress: optionalText,
    correspondenceSameAsPrimary: z.literal("on").optional(),
    lastSchoolName: optionalText,
    fatherName: optionalText,
    fatherOccupation: z.string().trim().max(100).optional().transform((v) => v || null),
    guardianName: optionalText,
    guardianIsFather: z.literal("on").optional(),
    motherName: optionalText,
    admissionDate: optionalDate,
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
    // "Same as" checkboxes copy the other field.
    let whatsappNumber = data.whatsappNumber;
    if (whatsappSameAsPhone) {
      whatsappNumber = data.phone ? normalizeIndianMobile(data.phone) : null;
      if (data.phone && !whatsappNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Enter a valid 10-digit mobile number to use it for WhatsApp",
        });
        return z.NEVER;
      }
    }
    return {
      ...data,
      whatsappNumber,
      correspondenceAddress: correspondenceSameAsPrimary ? data.primaryAddress : data.correspondenceAddress,
      guardianName: guardianIsFather ? data.fatherName : data.guardianName,
    };
  });

export type StudentInput = z.infer<typeof studentSchema>;
