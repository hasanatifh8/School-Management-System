"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { inputClass } from "@/components/ui";

// No look-alike characters (0/O, 1/l/I) so a password can be read out or typed from paper.
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** 12 characters from a secure random source, always with letters and digits. */
function generatePassword() {
  const pick = (set: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join("");
  const chars = (pick(LETTERS, 9) + pick(DIGITS, 3)).split("");
  const order = crypto.getRandomValues(new Uint32Array(chars.length));
  return chars
    .map((c, i) => [order[i], c] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c)
    .join("");
}

/** Password input with show/hide and optional "Generate" + "Copy" buttons. */
export function PasswordField({
  name,
  generate = false,
  autoComplete = "new-password",
  required = true,
  placeholder,
  keepAfterSave = false,
}: {
  name: string;
  generate?: boolean;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  /** Keep the value after a successful save (so a password set for someone else can still be copied). */
  keepAfterSave?: boolean;
}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Forms reset after a successful save; clear the password unless asked to keep it.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || keepAfterSave) return;
    const onReset = () => {
      setValue("");
      setVisible(false);
      setCopied(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [keepAfterSave]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${inputClass} pr-10 ${visible ? "font-mono" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {generate && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              setValue(generatePassword());
              setVisible(true);
              setCopied(false);
            }}
            className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Wand2 className="h-3.5 w-3.5" /> Generate strong password
          </button>
          {value && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
