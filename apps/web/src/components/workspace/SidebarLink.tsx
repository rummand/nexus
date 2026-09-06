"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarLink({ href, icon, children, exact = false, trailing, className }: { href: string; icon?: ReactNode; children: ReactNode; exact?: boolean; trailing?: ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    /*
      Explicit keys on these three: the React compiler builds them as an array once the sidebar is
      large enough, and React then warns about a list with no keys. Same fix as the nav itself.
    */
    <Link href={href} className={[active ? "active" : "", className ?? ""].join(" ").trim()}>
      <span key="icon" className="nav-icon">{icon}</span>
      <span key="label">{children}</span>
      {trailing !== undefined && <span key="count" className="nav-count">{trailing}</span>}
    </Link>
  );
}
