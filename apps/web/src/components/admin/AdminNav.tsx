"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users } from "lucide-react";

/** Two places, because there are two questions: who are the customers, and who are the people. */
export function AdminNav() {
  const path = usePathname();
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav className="admin-nav" aria-label="Platform console">
      <Link href="/admin" className={on("/admin") ? "on" : ""} data-admin-nav="tenants">
        <Building2 size={14} /> Tenants
      </Link>
      <Link href="/admin/people" className={on("/admin/people") ? "on" : ""} data-admin-nav="people">
        <Users size={14} /> People
      </Link>
    </nav>
  );
}
