import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <EmptyState
        icon={SearchX}
        title="Record not found"
        description="It may have been deleted, or the link is incorrect."
        action={<ButtonLink href="/admin">Back to dashboard</ButtonLink>}
      />
    </div>
  );
}
