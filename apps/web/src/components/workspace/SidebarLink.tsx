"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export function SidebarLink({ href, icon, children, exact = false, trailing }: { href: string; icon?: ReactNode; children: ReactNode; exact?: boolean; trailing?: ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active ? "bg-accent-50 text-accent-700 font-medium" : "text-ink-700 hover:bg-ink-100",
      )}
    >
      {icon && <span className={cx("flex h-5 w-5 items-center justify-center text-base leading-none", active ? "text-accent-600" : "text-ink-500")}>{icon}</span>}
      <span className="truncate">{children}</span>
      {trailing && <span className="ml-auto text-[11px] text-ink-400">{trailing}</span>}
    </Link>
  );
}
