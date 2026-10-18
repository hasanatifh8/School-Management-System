import { redirect } from "next/navigation";

/** Moved to Settings → Teacher & staff leave. */
export default function LeaveAllowancesMoved() {
  redirect("/admin/settings/leave");
}
