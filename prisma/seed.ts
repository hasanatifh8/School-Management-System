import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { nextStudentCode, nextTeacherCode } from "../src/lib/codes";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (await db.school.count()) {
    console.log("Database already has a school — skipping seed.");
    return;
  }

  const school = await db.school.create({ data: { name: "Demo Public School", code: "DPS" } });

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
    for (const [firstName, lastName, gender, fatherName, motherName, fatherPhone, motherPhone] of [
      ["Aarav", "Gupta", "MALE", "Sanjay Gupta", "Neha Gupta", "9810000001", "9810000002"],
      ["Diya", "Patel", "FEMALE", "Mehul Patel", "Kavita Patel", "9820000001", "9820000002"],
    ] as const) {
      const admissionDate = new Date();
      await tx.student.create({
        data: {
          schoolId: school.id,
          studentCode: await nextStudentCode(tx, school.id, admissionDate),
          firstName,
          lastName,
          gender,
          fatherName,
          fatherPhone,
          motherName,
          motherPhone,
          admissionDate,
          sectionId: section.id,
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
