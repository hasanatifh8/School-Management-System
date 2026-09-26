"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { buttonClass } from "./button";
import { cx } from "./cx";

const CloseContext = createContext<() => void>(() => {});

/**
 * A "More" dropdown for secondary actions. Arrow keys move between items,
 * Esc or a click outside closes it.
 */
export function MoreMenu({
  children,
  label = "More actions",
  icon = <MoreHorizontal />,
  text,
  align = "end",
}: {
  children: ReactNode;
  label?: string;
  /** Rendered icon element, e.g. `<Settings2 />`. */
  icon?: ReactNode;
  /** Visible button text; icon-only when omitted. */
  text?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    // Focus the first item when opening.
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={text ? undefined : label}
        title={text ? undefined : label}
        onClick={() => setOpen((o) => !o)}
        className={cx(buttonClass({ variant: "secondary" }), text ? "max-sm:!w-10 max-sm:!px-0" : "!w-10 !px-0")}
      >
        {icon}
        {text && <span className="hidden sm:inline">{text}</span>}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cx(
            "absolute top-full z-40 mt-2 min-w-52 origin-top animate-pop rounded-2xl border border-line bg-surface p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
        </div>
      )}
    </div>
  );
}

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-fg-2 outline-none transition hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-subtle";

/** `icon` is a rendered element (e.g. `<Upload />`) so server pages can pass it. */
export function MenuLink({ href, icon, children, download }: { href: string; icon?: ReactNode; children: ReactNode; download?: boolean }) {
  const close = useContext(CloseContext);
  return (
    download ? (
      <a href={href} download role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        {icon}
        {children}
      </a>
    ) : (
      <Link href={href} role="menuitem" tabIndex={-1} onClick={close} className={itemClass}>
        {icon}
        {children}
      </Link>
    )
  );
}

export function MenuButton({
  onClick,
  icon,
  children,
  danger,
}: {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  const close = useContext(CloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        close();
        onClick();
      }}
      className={cx(itemClass, danger && "!text-danger hover:!bg-danger-soft [&_svg]:!text-danger")}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}
