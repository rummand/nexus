"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Plug, Shield, ShieldCheck, UserCog } from "lucide-react";
import { PLATFORM, SETTINGS } from "@/components/workspace/nav";

const ICON: Record<string, React.ReactNode> = {
  people: <UserCog size={16} />,
  models: <Cpu size={16} />,
  connections: <Plug size={16} />,
  safety: <ShieldCheck size={16} />,
};

/**
 * The settings area's own nav (§5.65).
 *
 * The platform console sits under a rule of its own and below a divider: it is not this
 * workspace's settings — it is the deployment every workspace is on — and an operator arriving
 * from one tenant should not be able to mistake it for that tenant's own configuration.
 */
export function SettingsNav({ slug, isOperator, workspaceName }: { slug: string; isOperator: boolean; workspaceName: string }) {
  const path = usePathname();
  const base = `/w/${slug}`;
  return (
    <nav className="settings-nav" aria-label="Settings">
      <div className="settings-nav-head">
        <span>Settings</span>
        <b>{workspaceName}</b>
      </div>
      {SETTINGS.map((item) => (
        <Link
          key={item.id}
          href={`${base}${item.path}`}
          className={path.startsWith(`${base}${item.path}`) ? "on" : ""}
          data-settings-nav={item.id}
        >
          {ICON[item.id]} {item.label}
        </Link>
      ))}
      {isOperator && (
        <>
          <hr />
          <span className="settings-nav-note">Above this workspace</span>
          <Link href={PLATFORM.path} className={path.startsWith("/admin") ? "on" : ""} data-settings-nav="platform">
            <Shield size={16} /> {PLATFORM.label}
          </Link>
        </>
      )}
    </nav>
  );
}
