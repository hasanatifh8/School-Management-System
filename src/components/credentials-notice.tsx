"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/** Shows freshly generated login details once, with copy buttons. */
export function CredentialsNotice({
  username,
  password,
  message,
}: {
  username: string;
  password: string;
  message?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  };
  const rows: [string, string][] = [
    ["Username", username],
    ["Password", password],
  ];
  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium text-emerald-900">
        <KeyRound className="h-4 w-4" /> {message ?? "Login details"}
      </p>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-emerald-100">
            <dt className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="flex-1 font-mono text-base text-slate-900" data-credential={label.toLowerCase()}>
              {value}
            </dd>
            <button
              type="button"
              onClick={() => copy(label, value)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              {copied === label ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === label ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => copy("Both", `Username: ${username}\nPassword: ${password}\nSign in at: ${window.location.origin}/login?role=teacher`)}
        className="mt-3 text-xs font-medium text-emerald-800 underline"
      >
        {copied === "Both" ? "Copied sign-in details" : "Copy both with the sign-in link"}
      </button>
      <p className="mt-2 text-xs text-emerald-800/80">The password is shown only now. Reset it later if it gets lost.</p>
    </div>
  );
}
