import { PageHeader } from "@/components/ui";
import { StaffTabs } from "./staff-tabs";

export default function StaffLayout({ children }: LayoutProps<"/admin/staff">) {
  return (
    <>
      <PageHeader title="Staff" subtitle="Non-teaching staff on the payroll, and sign-in accounts for fees staff." />
      <StaffTabs />
      {children}
    </>
  );
}
