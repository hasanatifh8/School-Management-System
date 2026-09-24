import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { nextStudentCode, nextTeacherCode } from "../src/lib/codes";
import { academicStartYear, sessionDates, sessionName } from "../src/lib/session-dates";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (await db.school.count()) {
    console.log("Database already has a school — skipping seed.");
    return;
  }

  const school = await db.school.create({ data: { name: "Demo Public School", code: "DPS" } });
  const year = academicStartYear();
  const session = await db.academicSession.create({
    data: { schoolId: school.id, name: sessionName(year), ...sessionDates(year), status: "CURRENT" },
  });

  const subjects = await Promise.all(
    [
      ["English", "ENG"],
      ["Mathematics", "MATH"],
      ["Science", "SCI"],
      ["Social Studies", "SST"],
      ["Hindi", "HIN"],
      ["Computer Science", "CS"],
    ].map(([name, code]) => db.subject.create({ data: { schoolId: school.id, name, code } })),
  );

  for (let i = 1; i <= 5; i++) {
    await db.schoolClass.create({
      data: {
        schoolId: school.id,
        name: `Class ${i}`,
        sortOrder: i,
        sections: { create: [{ name: "A" }, { name: "B" }] },
        // Computer Science starts from Class 3.
        subjects: {
          create: subjects
            .filter((s) => s.code !== "CS" || i >= 3)
            .map((s) => ({ subjectId: s.id })),
        },
      },
    });
  }

  const houses = await Promise.all(
    [
      ["Red House", "red", "Courage and strength"],
      ["Green House", "green", "Growth and harmony"],
      ["Blue House", "blue", "Wisdom and truth"],
      ["Yellow House", "yellow", "Joy and energy"],
    ].map(([name, color, description]) => db.house.create({ data: { schoolId: school.id, name, color, description } })),
  );

  await db.$transaction(async (tx) => {
    for (const [firstName, lastName, gender, qualification] of [
      ["Anita", "Sharma", "FEMALE", "M.A., B.Ed"],
      ["Rahul", "Verma", "MALE", "M.Sc, B.Ed"],
    ] as const) {
      await tx.teacher.create({
        data: {
          schoolId: school.id,
          employeeCode: await nextTeacherCode(tx, school.id),
          firstName,
          lastName,
          gender,
          qualification,
        },
      });
    }

    const section = await tx.section.findFirstOrThrow({
      where: { name: "A", class: { schoolId: school.id, name: "Class 1" } },
      include: { class: { include: { subjects: true } } },
    });
    for (const [i, [firstName, lastName, gender, fatherName, motherName, whatsappNumber]] of ([
      ["Aarav", "Gupta", "MALE", "Sanjay Gupta", "Neha Gupta", "9810000001"],
      ["Diya", "Patel", "FEMALE", "Mehul Patel", "Kavita Patel", "9820000001"],
    ] as const).entries()) {
      const admissionDate = new Date();
      await tx.student.create({
        data: {
          schoolId: school.id,
          studentCode: await nextStudentCode(tx, school.id, admissionDate),
          firstName,
          lastName,
          gender,
          fatherName,
          motherName,
          whatsappNumber,
          nationality: "Indian",
          primaryAddress: "12 MG Road, Lucknow, Uttar Pradesh 226001",
          correspondenceAddress: "12 MG Road, Lucknow, Uttar Pradesh 226001",
          admissionDate,
          sectionId: section.id,
          rollNumber: i + 1,
          enrollments: { create: { sessionId: session.id, sectionId: section.id, rollNumber: i + 1 } },
          houseId: houses[i % houses.length].id,
          subjects: {
            create: section.class.subjects.map((cs) => ({ subjectId: cs.subjectId })),
          },
        },
      });
    }
  });

  console.log(`Seeded "${school.name}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
