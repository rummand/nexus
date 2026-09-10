/**
 * What is in the sidebar, and what is not (§5.65).
 *
 * The rail had grown to nineteen entries in one undifferentiated run — Home next to Models next to
 * Documentation next to the platform console — because every revision that added a surface added a
 * line here and nobody ever read the whole list. Nineteen things with no grouping is not a
 * navigation; it is an inventory, and the cost is paid by everybody who scans it several times a
 * day looking for the four they actually use.
 *
 * Two rules shape what follows, and they are the whole design:
 *
 * **The rail shows the work, not the plumbing.** Boards, the model, the data coming in — daily.
 * Which model provider is configured, who is in the workspace, what an MCP key is — monthly, and
 * usually because something is wrong. Frequency is the honest axis, so the monthly things move
 * behind one entry and get a screen of their own instead of four slots in the rail.
 *
 * **A group is worth a label or it is not a group.** Four quiet headings turn a list of thirteen
 * into four things to choose between, which is a scan rather than a search. The first group is
 * deliberately unlabelled: Home, Recent and Starred are the workspace itself and naming that
 * states the obvious.
 *
 * Kept as data rather than JSX so the shape can be argued with in a test — no duplicate address,
 * nothing in two groups, and nothing administrative smuggled back into the rail.
 */

export interface NavItem {
  /** Stable key, also the icon's name in the component. */
  id: string;
  label: string;
  /** Appended to /w/[slug]; "" is the workspace home. */
  path: string;
  /** Only this exact path highlights, rather than it and everything under it. */
  exact?: boolean;
  /** Shown to platform operators only (§5.64). */
  operatorOnly?: boolean;
}

export interface NavGroup {
  /** Null for the first group: naming "the workspace itself" says nothing. */
  label: string | null;
  items: NavItem[];
}

/** The rail: what somebody opens Nexus to do. */
export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { id: "home", label: "Home", path: "", exact: true },
      { id: "recent", label: "Recent", path: "/recent" },
      { id: "favorites", label: "Starred", path: "/favorites" },
      { id: "teams", label: "Teams", path: "/teams" },
    ],
  },
  {
    label: "Model",
    items: [
      { id: "graph", label: "Knowledge graph", path: "/graph" },
      { id: "explore", label: "Graph explorer", path: "/explore" },
      { id: "meta", label: "Meta-model", path: "/meta" },
      { id: "history", label: "What changed", path: "/history" },
    ],
  },
  {
    label: "Data",
    items: [
      { id: "intake", label: "Intake", path: "/intake" },
      { id: "import", label: "Import", path: "/import" },
    ],
  },
  {
    label: "Work",
    items: [
      { id: "wiki", label: "Wiki", path: "/wiki" },
      { id: "roadmap", label: "Roadmap", path: "/roadmap" },
      { id: "agents", label: "Agents", path: "/agents" },
      { id: "knowledge", label: "EA knowledge", path: "/knowledge" },
    ],
  },
];

/**
 * The settings area: everything configured rather than used.
 *
 * One entry in the rail opens this, and it has its own nav — the pattern every tool this audience
 * already uses settled on, because settings are a place you go, do one thing, and leave.
 */
export const SETTINGS: NavItem[] = [
  { id: "people", label: "People", path: "/settings/people" },
  { id: "models", label: "Models", path: "/settings/models" },
  { id: "connections", label: "Connections", path: "/settings/connections" },
];

/** Below the settings nav, and out of the rail entirely: the deployment, for whoever runs it. */
export const PLATFORM: NavItem = { id: "platform", label: "Platform", path: "/admin", operatorOnly: true };

/** Reachable from anywhere without taking a slot in the rail. */
export const HELP: NavItem = { id: "docs", label: "Documentation", path: "/docs" };

export const railItems = (): NavItem[] => NAV.flatMap((g) => g.items);
export const allItems = (): NavItem[] => [...railItems(), ...SETTINGS, PLATFORM, HELP];
