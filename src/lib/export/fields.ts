// Columns the admin can choose when exporting to Excel (shared by the export
// dialog and the file builder).

export type ExportKind = "students" | "teachers";

export type ExportField = { key: string; label: string; group: string; default?: boolean };

export const EXPORT_FIELDS: Record<ExportKind, ExportField[]> = {
  students: [
    { key: "studentCode", label: "Student ID", group: "Basic", default: true },
    { key: "fullName", label: "Full name", group: "Basic", default: true },
    { key: "firstName", label: "First name", group: "Basic" },
    { key: "middleName", label: "Middle name", group: "Basic" },
    { key: "lastName", label: "Last name", group: "Basic" },
    { key: "gender", label: "Gender", group: "Basic", default: true },
    { key: "dateOfBirth", label: "Date of birth", group: "Basic", default: true },
    { key: "bloodGroup", label: "Blood group", group: "Basic" },
    { key: "status", label: "Status", group: "Basic" },

    { key: "classSection", label: "Class & section", group: "Academic", default: true },
    { key: "className", label: "Class", group: "Academic" },
    { key: "sectionName", label: "Section", group: "Academic" },
    { key: "rollNumber", label: "Roll number", group: "Academic", default: true },
    { key: "house", label: "House", group: "Academic" },
    { key: "admissionDate", label: "Admission date", group: "Academic" },
    { key: "lastSchoolName", label: "Last school", group: "Academic" },

    { key: "fatherName", label: "Father's name", group: "Family", default: true },
    { key: "motherName", label: "Mother's name", group: "Family", default: true },

    { key: "phone", label: "Phone", group: "Contact", default: true },
    { key: "whatsappNumber", label: "WhatsApp", group: "Contact" },
    { key: "email", label: "Email", group: "Contact" },
    { key: "primaryAddress", label: "Primary address", group: "Contact" },
    { key: "correspondenceAddress", label: "Correspondence address", group: "Contact" },

    { key: "aadhaarNumber", label: "Aadhaar number", group: "Identity & background" },
    { key: "category", label: "Category", group: "Identity & background" },
    { key: "religion", label: "Religion", group: "Identity & background" },
    { key: "caste", label: "Caste", group: "Identity & background" },
    { key: "nationality", label: "Nationality", group: "Identity & background" },
  ],
  teachers: [
    { key: "employeeCode", label: "Teacher ID", group: "Basic", default: true },
    { key: "fullName", label: "Full name", group: "Basic", default: true },
    { key: "firstName", label: "First name", group: "Basic" },
    { key: "middleName", label: "Middle name", group: "Basic" },
    { key: "lastName", label: "Last name", group: "Basic" },
    { key: "gender", label: "Gender", group: "Basic", default: true },
    { key: "bloodGroup", label: "Blood group", group: "Basic" },
    { key: "status", label: "Status", group: "Basic" },

    { key: "phone", label: "Phone", group: "Contact", default: true },
    { key: "email", label: "Email", group: "Contact", default: true },

    { key: "qualification", label: "Qualification", group: "Work", default: true },
    { key: "joiningDate", label: "Joining date", group: "Work" },
    { key: "classTeacherOf", label: "Class teacher of", group: "Work", default: true },
    { key: "subjectsTaught", label: "Subjects taught", group: "Work", default: true },
  ],
};
