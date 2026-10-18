import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/queries";
import type { Member } from "./group-form";

/** Every active teacher and staff member, with the leave group they are in. */
export async function loadMembers(schoolId: string): Promise<{ members: Member[]; inGroup: (policyId: string) => string[] }> {
  const [teachers, staff] = await Promise.all([
    db.teacher.findMany({
      where: { schoolId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, employeeCode: true, specialization: true, leavePolicyId: true, leavePolicy: { select: { name: true } } },
    }),
    db.staffMember.findMany({
      where: { schoolId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true, designation: true, leavePolicyId: true, leavePolicy: { select: { name: true } } },
    }),
  ]);
  const members: Member[] = [
    ...teachers.map((t) => ({
      id: t.id,
      kind: "teacher" as const,
      name: fullName(t),
      sub: [t.employeeCode, t.specialization].filter(Boolean).join(" · "),
      group: t.leavePolicy?.name ?? null,
    })),
    ...staff.map((s) => ({ id: s.id, kind: "staff" as const, name: s.name, sub: [s.employeeCode, s.designation].filter(Boolean).join(" · "), group: s.leavePolicy?.name ?? null })),
  ];
  return {
    members,
    inGroup: (policyId) => [...teachers.filter((t) => t.leavePolicyId === policyId).map((t) => `teacher:${t.id}`), ...staff.filter((s) => s.leavePolicyId === policyId).map((s) => `staff:${s.id}`)],
  };
}
