// Column layout of the bulk-upload Excel templates (shared by the template,
// the importer and the upload page).

export type ImportKind = "students" | "teachers";

export type ImportColumn = {
  key: string;
  header: string;
  required?: boolean;
  example: string;
  note?: string;
  /** Dropdown values in the template. "classes" is filled from the school's classes. */
  list?: readonly string[] | "classes";
  width?: number;
};

const GENDERS = ["Male", "Female", "Other"] as const;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const IMPORT_COLUMNS: Record<ImportKind, ImportColumn[]> = {
  students: [
    { key: "firstName", header: "First name", required: true, example: "Aarav", width: 16 },
    { key: "middleName", header: "Middle name", example: "", width: 14 },
    { key: "lastName", header: "Last name", required: true, example: "Sharma", width: 16 },
    { key: "gender", header: "Gender", example: "Male", list: GENDERS, width: 10 },
    { key: "dateOfBirth", header: "Date of birth", example: "15-08-2015", note: "DD-MM-YYYY", width: 14 },
    { key: "className", header: "Class", example: "Class 1", list: "classes", note: "As named in Classes", width: 12 },
    { key: "sectionName", header: "Section", example: "A", width: 9 },
    { key: "rollNumber", header: "Roll number", example: "1", note: "Unique in the section", width: 12 },
    { key: "fatherName", header: "Father's name", example: "Rajesh Sharma", width: 18 },
    { key: "fatherOccupation", header: "Father's occupation", example: "Engineer", width: 18 },
    { key: "motherName", header: "Mother's name", example: "Sunita Sharma", width: 18 },
    { key: "guardianName", header: "Guardian", example: "", note: "Blank = father is the guardian", width: 18 },
    { key: "phone", header: "Phone", example: "9876543210", width: 14 },
    { key: "aadhaarNumber", header: "Aadhaar number", example: "1234-5678-9012", note: "12 digits", width: 17 },
    { key: "bloodGroup", header: "Blood group", example: "B+", list: BLOOD_GROUPS, width: 12 },
    { key: "admissionDate", header: "Admission date", example: "01-04-2026", note: "DD-MM-YYYY; blank = today", width: 15 },
  ],
  teachers: [
    { key: "firstName", header: "First name", required: true, example: "Anita", width: 16 },
    { key: "middleName", header: "Middle name", example: "", width: 14 },
    { key: "lastName", header: "Last name", required: true, example: "Verma", width: 16 },
    { key: "gender", header: "Gender", example: "Female", list: GENDERS, width: 10 },
    { key: "dateOfBirth", header: "Date of birth", example: "12-06-1988", note: "DD-MM-YYYY", width: 14 },
    { key: "phone", header: "Phone", example: "9812345678", width: 14 },
    { key: "whatsappNumber", header: "WhatsApp", example: "9812345678", width: 14 },
    { key: "email", header: "Email", example: "anita.verma@example.com", width: 26 },
    { key: "qualification", header: "Qualification", example: "M.Sc, B.Ed", width: 18 },
    { key: "specialization", header: "Specialization", example: "Mathematics", width: 18 },
    { key: "experienceYears", header: "Experience (years)", example: "8", width: 12 },
    { key: "monthlySalary", header: "Monthly salary", example: "45000", note: "Rupees, whole number", width: 14 },
    { key: "address", header: "Address", example: "12 MG Road, Lucknow", width: 28 },
    { key: "joiningDate", header: "Joining date", example: "01-04-2026", note: "DD-MM-YYYY; blank = today", width: 14 },
    { key: "bloodGroup", header: "Blood group", example: "O+", list: BLOOD_GROUPS, width: 12 },
  ],
};

/** Rows per upload; keeps one import comfortably inside a single request. */
export const MAX_IMPORT_ROWS = 300;
