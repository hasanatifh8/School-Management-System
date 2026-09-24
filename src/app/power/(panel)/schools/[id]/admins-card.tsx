import { KeyRound, Trash2, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PasswordField } from "@/components/password-field";
import { Avatar, Badge, Card, inputClass } from "@/components/ui";
import { createSchoolAdmin, deleteSchoolAdmin, resetAdminPassword, setAdminActive } from "../../../actions";

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

type Admin = { id: string; name: string; email: string; active: boolean; lastLoginAt: Date | null };

/** Power Admin's list of a school's admin accounts, with add / reset / disable / delete. */
export function AdminsCard({ schoolId, schoolName, admins }: { schoolId: string; schoolName: string; admins: Admin[] }) {
  return (
    <Card title="School admins" icon={UserCog} description={`People who sign in at /login to manage ${schoolName}.`} padded={false}>
      {admins.length === 0 ? (
        <p className="border-b border-slate-100 px-6 py-5 text-sm text-amber-700">
          No admins yet. Only Power Admin can open this school until you add one.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border-b border-slate-100">
          {admins.map((a) => (
            <li key={a.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {a.name}{" "}
                    {a.active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="red" dot>Disabled</Badge>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {a.email} · {a.lastLoginAt ? `last sign-in ${when.format(a.lastLoginAt)}` : "never signed in"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <ActionForm action={setAdminActive.bind(null, a.id, !a.active)} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      confirm={a.active ? `Disable ${a.name}? They will be signed out.` : undefined}
                      icon={a.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    >
                      {a.active ? "Disable" : "Enable"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteSchoolAdmin.bind(null, a.id)} compact className="flex flex-row-reverse items-center gap-2">
                    <SubmitButton variant="dangerGhost" size="sm" confirm={`Delete ${a.name}'s account?`} icon={<Trash2 className="h-4 w-4" />}>
                      <span className="sr-only">Delete {a.name}</span>
                    </SubmitButton>
                  </ActionForm>
                </div>
              </div>
              <details className="group mt-2 pl-10">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </summary>
                <ActionForm action={resetAdminPassword.bind(null, a.id)} className="mt-2 space-y-2">
                  <PasswordField name="newPassword" generate keepAfterSave placeholder="New password" />
                  <SubmitButton variant="secondary" size="sm">
                    Set new password
                  </SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="px-6 py-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
          <UserPlus className="h-4 w-4 text-indigo-500" /> Add an admin
        </p>
        <ActionForm action={createSchoolAdmin.bind(null, schoolId)} className="space-y-3">
          <Field label="Name" name="adminName" required>
            <input name="adminName" required className={inputClass} />
          </Field>
          <Field label="Email (used to sign in)" name="adminEmail" required>
            <input type="email" name="adminEmail" required autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Password" name="adminPassword" required hint="At least 8 characters with a letter and a number.">
            <PasswordField name="adminPassword" generate keepAfterSave />
          </Field>
          <SubmitButton icon={<UserPlus className="h-4 w-4" />}>Add admin</SubmitButton>
        </ActionForm>
      </div>
    </Card>
  );
}
