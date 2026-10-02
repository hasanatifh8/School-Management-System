import { GraduationCap, Presentation } from "lucide-react";
import { StatusTab, tabBarClass } from "@/components/ui";

/** Students / Staff switch at the top of Attendance; keeps the chosen date. */
export function AttendanceTabs({ active, date }: { active: "students" | "staff"; date: string }) {
  return (
    <div className="mb-6 border-b border-line">
      <nav aria-label="Attendance" className={tabBarClass}>
        <StatusTab href={`/admin/attendance?date=${date}`} active={active === "students"} label="Students" icon={GraduationCap} />
        <StatusTab href={`/admin/attendance/staff?date=${date}`} active={active === "staff"} label="Staff" icon={Presentation} />
      </nav>
    </div>
  );
}
