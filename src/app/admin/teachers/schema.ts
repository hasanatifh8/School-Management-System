// Validation for teacher data, shared by the teacher form and the bulk importer.
import { z } from "zod";
import { optionalBloodGroup, optionalDate, optionalGender, optionalText, requiredText } from "@/lib/action-state";

export const teacherSchema = z.object({
  firstName: requiredText("First name"),
  middleName: optionalText,
  lastName: requiredText("Last name"),
  gender: optionalGender,
  bloodGroup: optionalBloodGroup,
  email: z.union([z.literal(""), z.email("Invalid email")]).optional().transform((v) => v || null),
  phone: optionalText,
  qualification: optionalText,
  joiningDate: optionalDate,
});

export type TeacherInput = z.infer<typeof teacherSchema>;
