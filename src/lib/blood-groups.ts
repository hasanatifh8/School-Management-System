// Blood group labels shared by the forms and the server.
import type { BloodGroup } from "@/generated/prisma/enums";

export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
};

export const BLOOD_GROUPS = Object.keys(BLOOD_GROUP_LABELS) as BloodGroup[];
