import { History } from "lucide-react";
import { Card, EmptyState, PageHeader, Table, tbodyClass, tdClass, thClass, theadClass, trClass } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function ActivityPage({ searchParams }: PageProps<"/power/activity">) {
  const paging = paginate(await searchParams, await db.auditLog.count(), 50);
  const entries = await db.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: paging.skip, take: paging.take });
  return (
    <>
      <PageHeader title="Activity log" subtitle="Every Power Admin action, newest first." />
      <Card padded={false}>
        {entries.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" />
        ) : (
          <Table>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Action</th>
                <th className={thClass}>School</th>
                <th className={thClass}>Details</th>
              </tr>
            </thead>
            <tbody className={tbodyClass}>
              {entries.map((e) => (
                <tr key={e.id} className={trClass}>
                  <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{when.format(e.createdAt)}</td>
                  <td className={`${tdClass} font-medium ${e.action.startsWith("Failed") ? "text-rose-700" : "text-slate-900"}`}>{e.action}</td>
                  <td className={tdClass}>{e.schoolName ?? "—"}</td>
                  <td className={`${tdClass} text-slate-500`}>{e.details ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination paging={paging} noun="entries" />
      </Card>
    </>
  );
}
