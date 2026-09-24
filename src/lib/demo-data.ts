// Sample data for trying the app: used by `npm run db:seed` and by Power
// Admin's "Load demo data". No server-only imports, so the seed script can use it.
import type { BloodGroup, Gender, Prisma } from "@/generated/prisma/client";
import { nextStudentCode, nextTeacherCode } from "@/lib/codes";
import { academicStartYear, sessionDates, sessionName } from "@/lib/session-dates";

const SUBJECTS = [
  ["English", "ENG"],
  ["Mathematics", "MATH"],
  ["Science", "SCI"],
  ["Social Studies", "SST"],
  ["Hindi", "HIN"],
  ["Computer Science", "CS"],
] as const;

const HOUSES = [
  ["Red House", "red", "Courage and strength"],
  ["Green House", "green", "Growth and harmony"],
  ["Blue House", "blue", "Wisdom and truth"],
  ["Yellow House", "yellow", "Joy and energy"],
] as const;

const TEACHERS: [string, string, Gender, string][] = [
  ["Anita", "Sharma", "FEMALE", "M.A., B.Ed"],
  ["Rahul", "Verma", "MALE", "M.Sc, B.Ed"],
  ["Sunita", "Rao", "FEMALE", "M.Sc (Maths), B.Ed"],
  ["Imran", "Khan", "MALE", "M.A. (English), B.Ed"],
];

// [first, last, gender, father, mother, blood group]
const STUDENTS: [string, string, Gender, string, string, BloodGroup][] = [
  ["Aarav", "Gupta", "MALE", "Sanjay Gupta", "Neha Gupta", "B_POS"],
  ["Diya", "Patel", "FEMALE", "Mehul Patel", "Kavita Patel", "O_POS"],
  ["Vihaan", "Singh", "MALE", "Harpreet Singh", "Simran Kaur", "A_POS"],
  ["Ananya", "Iyer", "FEMALE", "Ramesh Iyer", "Lakshmi Iyer", "AB_POS"],
  ["Kabir", "Mehta", "MALE", "Nikhil Mehta", "Pooja Mehta", "O_NEG"],
  ["Ishita", "Das", "FEMALE", "Arup Das", "Rina Das", "B_NEG"],
  ["Arjun", "Nair", "MALE", "Suresh Nair", "Divya Nair", "A_NEG"],
  ["Meera", "Joshi", "FEMALE", "Prakash Joshi", "Sneha Joshi", "O_POS"],
  ["Reyansh", "Kulkarni", "MALE", "Amit Kulkarni", "Swati Kulkarni", "B_POS"],
  ["Saanvi", "Reddy", "FEMALE", "Kiran Reddy", "Padma Reddy", "A_POS"],
  ["Advik", "Bose", "MALE", "Subhash Bose", "Mitali Bose", "AB_NEG"],
  ["Myra", "Chopra", "FEMALE", "Rohit Chopra", "Anjali Chopra", "O_POS"],
  ["Ayaan", "Qureshi", "MALE", "Faisal Qureshi", "Sana Qureshi", "B_POS"],
  ["Kiara", "Malhotra", "FEMALE", "Vikram Malhotra", "Ritu Malhotra", "A_POS"],
  ["Dhruv", "Pandey", "MALE", "Alok Pandey", "Seema Pandey", "O_POS"],
  ["Anika", "Menon", "FEMALE", "Rajiv Menon", "Asha Menon", "B_POS"],
  ["Shaurya", "Yadav", "MALE", "Manoj Yadav", "Geeta Yadav", "A_POS"],
  ["Navya", "Kapoor", "FEMALE", "Sameer Kapoor", "Nidhi Kapoor", "O_NEG"],
  ["Rudra", "Mishra", "MALE", "Deepak Mishra", "Kiran Mishra", "AB_POS"],
  ["Tara", "Sen", "FEMALE", "Amit Sen", "Rina Sen", "B_POS"],
];

/**
 * Fills an empty school with a session, subjects, Classes 1–5 (sections A/B),
 * houses, teachers with class/subject roles and 20 students with roll numbers.
 * Run inside a transaction.
 */
export async function loadDemoData(tx: Prisma.TransactionClient, schoolId: string) {
  const year = academicStartYear();
  const session =
    (await tx.academicSession.findFirst({ where: { schoolId, status: "CURRENT" } })) ??
    (await tx.academicSession.create({
      data: { schoolId, name: sessionName(year), ...sessionDates(year), status: "CURRENT" },
    }));

  const subjects: { id: string; code: string }[] = [];
  for (const [name, code] of SUBJECTS) subjects.push(await tx.subject.create({ data: { schoolId, name, code } }));

  const sections: { id: string; classIndex: number; curriculum: { subjectId: string }[] }[] = [];
  for (let i = 1; i <= 5; i++) {
    const cls = await tx.schoolClass.create({
      data: {
        schoolId,
        name: `Class ${i}`,
        sortOrder: i,
        sections: { create: [{ name: "A" }, { name: "B" }] },
        // Computer Science starts from Class 3.
        subjects: { create: subjects.filter((s) => s.code !== "CS" || i >= 3).map((s) => ({ subjectId: s.id })) },
      },
      include: { sections: { orderBy: { name: "asc" } }, subjects: true },
    });
    sections.push(...cls.sections.map((sec) => ({ ...sec, classIndex: i, curriculum: cls.subjects })));
  }

  const houses: { id: string }[] = [];
  for (const [name, color, description] of HOUSES) {
    houses.push(await tx.house.create({ data: { schoolId, name, color, description } }));
  }

  const teachers: { id: string }[] = [];
  for (const [firstName, lastName, gender, qualification] of TEACHERS) {
    teachers.push(
      await tx.teacher.create({
        data: { schoolId, employeeCode: await nextTeacherCode(tx, schoolId), firstName, lastName, gender, qualification },
      }),
    );
  }
  // Class teachers for Class 1-A … Class 2-B, and a few subject teachers.
  for (const [i, t] of teachers.entries()) {
    await tx.section.update({ where: { id: sections[i].id }, data: { classTeacherId: t.id } });
  }
  const bySubject = (code: string) => subjects.find((s) => s.code === code)!.id;
  for (const sec of sections.slice(0, 4)) {
    await tx.subjectTeacherAssignment.createMany({
      data: [
        { sectionId: sec.id, subjectId: bySubject("MATH"), teacherId: teachers[2].id },
        { sectionId: sec.id, subjectId: bySubject("ENG"), teacherId: teachers[3].id },
      ],
    });
  }

  // Two students per section, numbered A–Z within the section.
  const perSection = new Map<string, number>();
  const sorted = STUDENTS.map((s, i) => ({ s, section: sections[i % sections.length], house: houses[i % houses.length] }))
    .sort((a, b) => a.section.id.localeCompare(b.section.id) || a.s[0].localeCompare(b.s[0]));
  for (const { s, section, house } of sorted) {
    const [firstName, lastName, gender, fatherName, motherName, bloodGroup] = s;
    const rollNumber = (perSection.get(section.id) ?? 0) + 1;
    perSection.set(section.id, rollNumber);
    const admissionDate = new Date(Date.UTC(year, 3, 1));
    await tx.student.create({
      data: {
        schoolId,
        studentCode: await nextStudentCode(tx, schoolId, admissionDate),
        firstName,
        lastName,
        gender,
        bloodGroup,
        fatherName,
        motherName,
        // Age fits the class: about 5 years old in Class 1.
        dateOfBirth: new Date(Date.UTC(year - 5 - section.classIndex, (rollNumber * 3) % 12, 10 + rollNumber)),
        nationality: "Indian",
        admissionDate,
        sectionId: section.id,
        rollNumber,
        houseId: house.id,
        subjects: { create: section.curriculum.map((c) => ({ subjectId: c.subjectId })) },
        enrollments: { create: { sessionId: session.id, sectionId: section.id, rollNumber } },
      },
    });
  }

  return { students: STUDENTS.length, teachers: TEACHERS.length, classes: 5 };
}
