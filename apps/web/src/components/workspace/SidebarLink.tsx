"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarLink({ href, icon, children, exact = false, trailing, className }: { href: string; icon?: ReactNode; children: ReactNode; exact?: boolean; trailing?: ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={[active ? "active" : "", className ?? ""].join(" ").trim()}>
      {icon}
      <span>{children}</span>
      {trailing !== undefined && <span className="nav-count">{trailing}</span>}
    </Link>
  );
}
