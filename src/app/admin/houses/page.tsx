import Link from "next/link";
import { ArrowRight, Plus, Shield, Users } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { HouseColorPicker } from "@/components/house";
import { Avatar, EmptyState, IconTile, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { houseColor } from "@/lib/houses";
import { photoUrl } from "@/lib/photos";
import { fullName } from "@/lib/queries";
import { getCurrentSchool } from "@/lib/school";
import { createHouse } from "./actions";

export default async function HousesPage() {
  const school = await getCurrentSchool();
  const [houses, withoutHouse] = await Promise.all([
    db.house.findMany({
      where: { schoolId: school.id },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        students: {
          where: { status: "ACTIVE" },
          orderBy: { firstName: "asc" },
          take: 5,
          select: { id: true, firstName: true, middleName: true, lastName: true, photoId: true },
        },
      },
    }),
    db.student.count({ where: { schoolId: school.id, status: "ACTIVE", houseId: null } }),
  ]);

  return (
    <>
      <PageHeader
        title="Houses"
        subtitle={
          withoutHouse
            ? `${withoutHouse} active student(s) are not in a house yet.`
            : "Every active student is in a house."
        }
      />

      <div className="grid items-start gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {houses.map((h) => {
          const c = houseColor(h.color);
          const extra = h._count.students - h.students.length;
          return (
            <Link
              key={h.id}
              href={`/admin/houses/${h.id}`}
              className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className={`flex items-center gap-3 bg-gradient-to-r px-5 py-4 text-white ${c.banner}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <Shield className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">{h.name}</h2>
                  <p className="flex items-center gap-1 text-xs text-white/80">
                    <Users className="h-3.5 w-3.5" />
                    {h._count.students} {h._count.students === 1 ? "student" : "students"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/70 transition group-hover:translate-x-0.5" />
              </div>
              <div className="px-5 py-4">
                {h.description && <p className="mb-3 line-clamp-2 text-sm text-fg-2">{h.description}</p>}
                {h.students.length ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {h.students.map((s) => (
                        <span key={s.id} className="rounded-full ring-2 ring-surface">
                          <Avatar name={fullName(s)} src={photoUrl(s.photoId)} size="sm" />
                        </span>
                      ))}
                    </div>
                    {extra > 0 && <span className="ml-3 text-xs text-muted">+{extra} more</span>}
                  </div>
                ) : (
                  <p className="text-sm text-subtle">No students yet. Open to assign students.</p>
                )}
              </div>
            </Link>
          );
        })}

        <section className="rounded-2xl border-2 border-dashed border-line bg-surface/60 p-6">
          <div className="flex items-center gap-3">
            <IconTile icon={Plus} tone="indigo" />
            <div>
              <h2 className="font-semibold text-fg">Add a house</h2>
              <p className="text-xs text-muted">e.g. Green House, Red House, Tagore House.</p>
            </div>
          </div>
          <ActionForm action={createHouse} className="mt-5 space-y-4">
            <Field label="House name" name="name" required>
              <input name="name" required maxLength={60} placeholder="e.g. Green House" className={inputClass} />
            </Field>
            <HouseColorPicker />
            <Field label="Motto / description" name="description">
              <input name="description" maxLength={200} placeholder="Optional" className={inputClass} />
            </Field>
            <SubmitButton icon={<Plus className="h-4 w-4" />}>Create house</SubmitButton>
          </ActionForm>
        </section>
      </div>

      {houses.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={Shield} title="No houses yet" description="Create houses, then assign students to them." />
        </div>
      )}
    </>
  );
}
