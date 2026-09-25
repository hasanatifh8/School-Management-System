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

// [first, last, gender, qualification, specialization, years of experience]
const TEACHERS: [string, string, Gender, string, string, number][] = [
  ["Anita", "Sharma", "FEMALE", "M.A., B.Ed", "Social Studies", 12],
  ["Rahul", "Verma", "MALE", "M.Sc, B.Ed", "Science", 7],
  ["Sunita", "Rao", "FEMALE", "M.Sc (Maths), B.Ed", "Mathematics", 15],
  ["Imran", "Khan", "MALE", "M.A. (English), B.Ed", "English", 5],
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
 * houses, teachers with class/subject roles, 20 students with roll numbers and
 * a sample fee structure, plus non-teaching staff, budgets and three months
 * of salaries and bills.
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
  const classIds: string[] = [];
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
    classIds.push(cls.id);
  }

  // A typical fee structure: amounts rise with the class.
  const fees: [string, "ONE_TIME" | "MONTHLY" | "HALF_YEARLY" | "YEARLY", (i: number) => number, { optional?: boolean; dueMonth?: number }?][] = [
    ["Tuition fee", "MONTHLY", (i) => 1500 + 250 * i],
    ["Admission fee", "ONE_TIME", () => 5000],
    ["Annual charges", "YEARLY", (i) => 3000 + 500 * i, { dueMonth: 4 }],
    ["Exam fee", "HALF_YEARLY", () => 800],
    ["Transport", "MONTHLY", () => 1200, { optional: true }],
  ];
  for (const [n, [name, frequency, amount, extra]] of fees.entries()) {
    await tx.feeHead.create({
      data: {
        schoolId,
        sessionId: session.id,
        name,
        frequency,
        optional: extra?.optional ?? false,
        dueMonth: extra?.dueMonth ?? null,
        sortOrder: n + 1,
        amounts: { create: classIds.map((classId, i) => ({ classId, amount: amount(i) })) },
      },
    });
  }

  const houses: { id: string }[] = [];
  for (const [name, color, description] of HOUSES) {
    houses.push(await tx.house.create({ data: { schoolId, name, color, description } }));
  }

  const teachers: { id: string; firstName: string; lastName: string; monthlySalary: number | null }[] = [];
  for (const [firstName, lastName, gender, qualification, specialization, experienceYears] of TEACHERS) {
    teachers.push(
      await tx.teacher.create({
        data: {
          schoolId,
          employeeCode: await nextTeacherCode(tx, schoolId),
          firstName,
          lastName,
          gender,
          qualification,
          specialization,
          experienceYears,
          // Rough pay scale: ₹25,000 plus ₹1,500 per year of experience.
          monthlySalary: 25000 + experienceYears * 1500,
        },
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
        guardianName: fatherName,
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

  await loadDemoExpenses(tx, schoolId, teachers);

  return { students: STUDENTS.length, teachers: TEACHERS.length, classes: 5 };
}

const STAFF: [string, string, number][] = [
  ["Ramesh Yadav", "Accountant", 22000],
  ["Kamla Devi", "Helper", 9000],
  ["Suresh Singh", "Security guard", 12000],
  ["Mohan Lal", "Peon", 10000],
  ["Iqbal Ahmed", "Driver", 15000],
];

// Monthly running costs (₹) for the demo's past months: [category, amount].
const MONTHLY_COSTS: [string, number, string][] = [
  ["Electricity", 18500, "State Electricity Board"],
  ["Water", 2200, "Jal Board"],
  ["Internet & phone", 2999, "Broadband"],
  ["Stationery & supplies", 4500, "City Stationers"],
  ["Transport & fuel", 9000, "Fuel for school van"],
  ["Cleaning & housekeeping", 3000, "Cleaning supplies"],
];

/** Non-teaching staff, budgets and three months of paid salaries and bills. */
async function loadDemoExpenses(tx: Prisma.TransactionClient, schoolId: string, teachers: { id: string; firstName: string; lastName: string; monthlySalary: number | null }[]) {
  const staff = [];
  for (const [name, designation, monthlySalary] of STAFF) {
    staff.push(await tx.staffMember.create({ data: { schoolId, name, designation, monthlySalary } }));
  }
  const names = ["Electricity", "Water", "Events & functions", "Maintenance & repairs", "Stationery & supplies", "Transport & fuel", "Internet & phone", "Cleaning & housekeeping", "Other"];
  const budgets: Record<string, number> = { Electricity: 20000, Water: 2500, "Events & functions": 10000, "Maintenance & repairs": 8000, "Stationery & supplies": 5000, "Transport & fuel": 10000, "Internet & phone": 3000, "Cleaning & housekeeping": 3500 };
  const payroll = teachers.reduce((n, t) => n + (t.monthlySalary ?? 0), 0) + STAFF.reduce((n, s) => n + s[2], 0);
  await tx.expenseCategory.create({ data: { schoolId, name: "Salaries", isSalaries: true, sortOrder: 0, monthlyBudget: Math.ceil(payroll / 1000) * 1000 } });
  const categories = new Map<string, string>();
  for (const [i, name] of names.entries()) {
    const c = await tx.expenseCategory.create({ data: { schoolId, name, sortOrder: i + 1, monthlyBudget: budgets[name] ?? null } });
    categories.set(name, c.id);
  }

  const now = new Date();
  for (let back = 3; back >= 1; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const month = d.toISOString().slice(0, 7);
    const paidOn = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 28));
    await tx.salaryPayment.createMany({
      data: [
        ...teachers.map((t) => ({ schoolId, month, payeeType: "TEACHER" as const, teacherId: t.id, name: `${t.firstName} ${t.lastName}`, role: "Teacher", amount: t.monthlySalary ?? 0, paidOn, mode: "BANK_TRANSFER" as const, createdBy: "Demo data" })),
        ...staff.map((s) => ({ schoolId, month, payeeType: "STAFF" as const, staffId: s.id, name: s.name, role: s.designation, amount: s.monthlySalary ?? 0, paidOn, mode: "BANK_TRANSFER" as const, createdBy: "Demo data" })),
      ],
    });
    // Bills vary a little month to month; one month has a school event.
    for (const [name, amount, paidTo] of MONTHLY_COSTS) {
      await tx.expense.create({
        data: { schoolId, categoryId: categories.get(name)!, date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 12)), amount: Math.round(amount * (0.9 + back * 0.05)), paidTo, mode: "BANK_TRANSFER", createdBy: "Demo data" },
      });
    }
    if (back === 2) {
      await tx.expense.create({
        data: { schoolId, categoryId: categories.get("Events & functions")!, date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 20)), amount: 14000, paidTo: "Decorators & sound", description: "Independence Day function", mode: "CASH", createdBy: "Demo data" },
      });
    }
  }
}
