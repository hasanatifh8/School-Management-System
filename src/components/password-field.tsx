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
  labelledBy,
}: {
  name: string;
  generate?: boolean;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  /** Keep the value after a successful save (so a password set for someone else can still be copied). */
  keepAfterSave?: boolean;
  /** id of a visible label, when the field isn't wrapped in a <label>. */
  labelledBy?: string;
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
          aria-labelledby={labelledBy}
          className={`${inputClass} pr-10 ${visible ? "font-mono" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-fg-2"
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
            className="inline-flex items-center gap-1 rounded font-medium text-accent-text transition hover:text-accent-hover"
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
              className="inline-flex items-center gap-1 font-medium text-muted hover:text-fg"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
