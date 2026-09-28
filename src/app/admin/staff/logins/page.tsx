import { redirect } from "next/navigation";

/** Fees logins are now cashiers, made from a staff member's profile. */
export default function StaffLoginsPage() {
  redirect("/admin/staff?access=cashier");
}
