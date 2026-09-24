import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Shield, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { HouseBadge, HouseColorPicker } from "@/components/house";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  PersonCell,
  Table,
  buttonVariants,
  checkboxClass,
  inputClass,
  selectClass,
  tbodyClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { houseColor } from "@/lib/houses";
import { photoUrl } from "@/lib/photos";
import { fullName, getClassesWithSections, sectionLabel } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { assignStudentsToHouse, deleteHouse, removeStudentFromHouse, updateHouse } from "../actions";
import { SelectionControls } from "./selection-controls";

export default async function HousePage({ params, searchParams }: PageProps<"/admin/houses/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const classId = typeof sp.classId === "string" ? sp.classId : "";
  const includeOtherHouses = sp.scope === "all";
  const school = await getCurrentSchool();

  const candidateWhere: Prisma.StudentWhereInput = {
    schoolId: school.id,
    status: "ACTIVE",
    OR: includeOtherHouses ? [{ houseId: null }, { houseId: { not: id } }] : [{ houseId: null }],
    ...(classId && { section: { classId } }),
  };

  const [house, candidates, classes] = await Promise.all([
    db.house.findFirst({
      where: { id, schoolId: school.id },
      include: {
        students: {
          where: { status: "ACTIVE" },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          include: { section: { include: { class: true } } },
        },
      },
    }),
    db.student.findMany({
      where: candidateWhere,
      orderBy: [{ section: { class: { sortOrder: "asc" } } }, { firstName: "asc" }],
      include: { section: { include: { class: true } }, house: true },
      take: 300,
    }),
    getClassesWithSections(school.id),
  ]);
  if (!house) notFound();
  const c = houseColor(house.color);

  return (
    <>
      <PageHeader
        title={house.name}
        breadcrumbs={[{ label: "Houses", href: "/admin/houses" }, { label: house.name }]}
        subtitle={house.description ?? "Manage members and house details."}
      />

      <section className={`mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r p-6 text-white shadow-sm ${c.banner}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
          <Shield className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80">House</p>
          <p className="text-2xl font-semibold">{house.name}</p>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-2 text-right backdrop-blur">
          <p className="text-2xl font-semibold tabular-nums">{house.students.length}</p>
          <p className="text-xs text-white/80">active students</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Members" icon={Users} description={`${house.students.length} student(s)`} padded={false} className="xl:col-span-2 self-start">
          {house.students.length === 0 ? (
            <EmptyState icon={Users} title="No members yet" description="Use “Add students” to assign students to this house." />
          ) : (
            <Table>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Class</th>
                  <th className={thClass}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {house.students.map((s) => (
                  <tr key={s.id} className={trClass}>
                    <td className={tdClass}>
                      <PersonCell
                        name={fullName(s)}
                        href={`/admin/students/${s.id}`}
                        photoUrl={photoUrl(s.photoId)}
                        sub={<span className="font-mono">{s.studentCode}</span>}
                      />
                    </td>
                    <td className={tdClass}>
                      {s.section ? <Badge tone="indigo">{sectionLabel(s.section)}</Badge> : <Badge tone="amber">No class</Badge>}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <ActionForm
                        action={removeStudentFromHouse.bind(null, house.id, s.id)}
                        compact
                        className="flex flex-row-reverse items-center gap-2"
                      >
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          confirm={`Remove ${fullName(s)} from ${house.name}?`}
                          icon={<UserMinus className="h-4 w-4" />}
                        >
                          Remove
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6 self-start">
          <Card title="Add students" icon={UserPlus} description="Tick students to put them in this house.">
            <form className="mb-4 grid gap-2">
              <select name="classId" defaultValue={classId} className={`${selectClass} !py-2`}>
                <option value="">All classes</option>
                {classes.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
              <select name="scope" defaultValue={includeOtherHouses ? "all" : ""} className={`${selectClass} !py-2`}>
                <option value="">Students without a house</option>
                <option value="all">Also students in other houses</option>
              </select>
              <button className={`${buttonVariants.secondary} !py-2`}>Show</button>
            </form>

            {/* Always rendered so the result message stays visible after the list empties. */}
            <ActionForm action={assignStudentsToHouse.bind(null, house.id)} className="space-y-3">
              {candidates.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                  No matching students. {includeOtherHouses ? "" : "Try including students in other houses."}
                </p>
              ) : (
                <>
                  <SelectionControls total={candidates.length} />
                  <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                    {candidates.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/60">
                          <input type="checkbox" name="studentIds" value={s.id} className={checkboxClass} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-800">{fullName(s)}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {s.studentCode} · {s.section ? sectionLabel(s.section) : "No class"}
                            </span>
                          </span>
                          {s.house && <HouseBadge house={s.house} />}
                        </label>
                      </li>
                    ))}
                  </ul>
                  {candidates.length === 300 && (
                    <p className="text-xs text-slate-500">Showing the first 300. Filter by class to see more.</p>
                  )}
                  <SubmitButton icon={<UserPlus className="h-4 w-4" />}>Add to {house.name}</SubmitButton>
                </>
              )}
            </ActionForm>
          </Card>

          <Card title="Edit house" icon={Pencil}>
            <ActionForm action={updateHouse.bind(null, house.id)} className="space-y-4">
              <Field label="House name" name="name" required>
                <input name="name" required maxLength={60} defaultValue={house.name} className={inputClass} />
              </Field>
              <HouseColorPicker defaultValue={house.color} />
              <Field label="Motto / description" name="description">
                <input name="description" maxLength={200} defaultValue={house.description ?? ""} className={inputClass} />
              </Field>
              <SubmitButton>Save changes</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Delete house" description="Students stay in the school; they just won't have a house.">
            <ActionForm action={deleteHouse.bind(null, house.id)} compact className="flex flex-row-reverse items-center justify-end gap-3">
              <SubmitButton
                variant="danger"
                confirm={`Delete ${house.name}? Its ${house.students.length} student(s) will have no house.`}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete house
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Tip: you can also set a student&apos;s house from their{" "}
        <Link href="/admin/students" className="font-medium text-indigo-600 hover:underline">
          profile
        </Link>
        .
      </p>
    </>
  );
}
