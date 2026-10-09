import { fullName, sectionLabel } from "@/lib/names";

export type TeacherChoice = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  employeeCode: string;
  canTeach: { subjectId: string }[];
  classTeacherOf: { id: string; name: string; class: { name: string } }[];
};

/**
 * The <option>s of a teacher picker. For a subject, teachers who teach it come
 * first; anyone else can still be chosen (the subject is then added to theirs).
 * For a class teacher, each shows the classes they already look after.
 */
export function TeacherOptions({ teachers, subject, forSection, empty }: { teachers: TeacherChoice[]; subject?: { id: string; name: string }; forSection?: string; empty: string }) {
  const label = (t: TeacherChoice) => {
    const others = forSection ? t.classTeacherOf.filter((s) => s.id !== forSection) : [];
    return `${fullName(t)} (${t.employeeCode})${others.length ? ` · class teacher of ${others.map(sectionLabel).join(", ")}` : ""}`;
  };
  if (!subject)
    return (
      <>
        <option value="">{empty}</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {label(t)}
          </option>
        ))}
      </>
    );
  const teaches = teachers.filter((t) => t.canTeach.some((c) => c.subjectId === subject.id));
  const others = teachers.filter((t) => !teaches.includes(t));
  return (
    <>
      <option value="">{empty}</option>
      {teaches.length > 0 && (
        <optgroup label={`Teaches ${subject.name}`}>
          {teaches.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Other teachers">
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t)}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
