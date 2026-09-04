"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** Sidebar search: submits to the workspace home with ?q= so the board browser filters. */
export function SidebarSearch({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  return (
    <label className="studio-home-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(value.trim() ? `/w/${slug}?q=${encodeURIComponent(value.trim())}` : `/w/${slug}`);
        }}
        placeholder="Search by board or topic"
      />
    </label>
  );
}
