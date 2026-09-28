import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { getLoginSchool } from "@/lib/login-school";
import { getViewer } from "@/lib/school";
import { getSignedInTeacher } from "@/lib/teacher-auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Scholdesk" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getViewer()) redirect("/admin");
  if (await getSignedInTeacher()) redirect("/teacher");
  const params = await searchParams;
  const role = params.role === "teacher" ? "teacher" : "admin";
  const school = await getLoginSchool(params.school);
  return (
    <AuthLayout
      school={school}
      title="Welcome back"
      subtitle={school ? `Sign in to ${school.name}.` : "Sign in to your school's Scholdesk portal."}
      footer={
        <>
          Forgot your password? Teachers and cashiers: ask your school admin. School admins: ask your Power Admin.{" "}
          <Link href="/power/login" className="font-medium text-fg-2 underline-offset-4 hover:text-accent-text hover:underline">
            Power Admin sign-in
          </Link>
        </>
      }
    >
      <LoginForm initialRole={role} />
    </AuthLayout>
  );
}
