import { GraduationCap, Presentation } from "lucide-react";
import { StatusTab, tabBarClass } from "@/components/ui";

/** Students / Staff switch at the top of ID cards. */
export function IdCardTabs({ active }: { active: "students" | "staff" }) {
  return (
    <div className="mb-6 border-b border-line print:hidden">
      <nav aria-label="ID cards" className={tabBarClass}>
        <StatusTab href="/admin/id-cards" active={active === "students"} label="Students" icon={GraduationCap} />
        <StatusTab href="/admin/id-cards?tab=staff" active={active === "staff"} label="Teachers & staff" icon={Presentation} />
      </nav>
    </div>
  );
}
