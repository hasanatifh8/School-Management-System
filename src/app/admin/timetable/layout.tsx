import { TabCrumbs } from "@/components/tab-crumbs";
import { PageHeader } from "@/components/ui";
import { TimetableTabs } from "./timetable-tabs";

export default function TimetableLayout({ children }: LayoutProps<"/admin/timetable">) {
  return (
    <>
      <div className="print:hidden">
        <TabCrumbs crumbs={{ "/admin/timetable/periods": [{ label: "Settings", href: "/admin/settings" }, { label: "Bell schedule" }] }} />
        <PageHeader title="Timetable" subtitle="The weekly class timetable. Class teachers can edit their own class unless you lock it." />
      </div>
      <TimetableTabs />
      {children}
    </>
  );
}
