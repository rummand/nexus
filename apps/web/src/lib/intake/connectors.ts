import type { SourceKind } from "./types";

/**
 * The connector catalogue — the ecosystem of places an organisation's architecture is hiding.
 *
 * docs/BRIEF.md §2.1: every source is a connector, and a connector normalises data without
 * deciding what it means. The catalogue is deliberately larger than what is built: an
 * architecture platform is judged on the list of things it can reach, and showing the whole
 * intended surface — with "planned" said plainly rather than implied — is more honest than
 * shipping four tiles and pretending that is the ambition.
 */

export type ConnectorStatus = "available" | "planned";

export type ConnectorGroup = "unstructured" | "files" | "systems" | "repositories";

export interface Connector {
  id: string;
  name: string;
  group: ConnectorGroup;
  status: ConnectorStatus;
  /** What it brings in, in the words an architect would use. */
  summary: string;
  /** The source kind a sync from here produces. */
  produces: SourceKind;
}

export const CONNECTOR_GROUPS: Array<{ id: ConnectorGroup; name: string; detail: string }> = [
  { id: "unstructured", name: "Conversations", detail: "What people said, wrote and decided" },
  { id: "files", name: "Files", detail: "Whatever is already on someone's disk" },
  { id: "systems", name: "Enterprise systems", detail: "Systems of record with an API" },
  { id: "repositories", name: "Repositories", detail: "Code, data platforms and pipelines" },
];

export const CONNECTORS: Connector[] = [
  { id: "transcript", name: "Meeting transcript", group: "unstructured", status: "available", summary: "Teams or Zoom transcript (VTT or text): who said what, and what was decided.", produces: "transcript" },
  { id: "notes", name: "Notes & documents", group: "unstructured", status: "available", summary: "Pasted or uploaded prose — minutes, strategy notes, architecture decision records.", produces: "document" },
  { id: "email", name: "E-mail & chat export", group: "unstructured", status: "planned", summary: "Threads about a system, with the people and the timeline attached.", produces: "transcript" },
  { id: "table", name: "CSV / JSON", group: "files", status: "available", summary: "A structured list of entities and relations, mapped column by column.", produces: "table" },
  { id: "excel", name: "Excel workbook", group: "files", status: "planned", summary: "The application list that actually runs the organisation.", produces: "table" },
  { id: "visio", name: "Visio / draw.io", group: "files", status: "planned", summary: "Diagrams read as a graph rather than a picture.", produces: "table" },
  { id: "servicenow", name: "ServiceNow", group: "systems", status: "planned", summary: "CMDB configuration items, services and their dependencies.", produces: "connector" },
  { id: "jira", name: "Jira", group: "systems", status: "planned", summary: "Initiatives and epics, so change is on the same graph as the estate.", produces: "connector" },
  { id: "confluence", name: "Confluence", group: "systems", status: "planned", summary: "Space by space, the pages that describe systems nobody documented elsewhere.", produces: "document" },
  { id: "sharepoint", name: "SharePoint", group: "systems", status: "planned", summary: "Document libraries, including the spreadsheets that are really registries.", produces: "document" },
  { id: "entra", name: "Entra ID", group: "systems", status: "planned", summary: "People, teams and application registrations — ownership, from the source.", produces: "connector" },
  { id: "sap", name: "SAP", group: "systems", status: "planned", summary: "Modules, interfaces and the process footprint around them.", produces: "connector" },
  { id: "ardoq", name: "Ardoq / LeanIX", group: "systems", status: "planned", summary: "An existing EA repository, imported rather than retyped.", produces: "connector" },
  { id: "git", name: "Git repositories", group: "repositories", status: "planned", summary: "Services, their manifests and what they call at runtime.", produces: "connector" },
  { id: "databricks", name: "Databricks / Snowflake", group: "repositories", status: "planned", summary: "Data products, lineage and the pipelines between them.", produces: "connector" },
  { id: "opcua", name: "OT historian / OPC UA", group: "repositories", status: "planned", summary: "Industrial assets and signals, for the half of the estate that never had a CMDB.", produces: "connector" },
];

export const connectorById = (id: string): Connector | undefined => CONNECTORS.find((c) => c.id === id);

export const availableConnectors = () => CONNECTORS.filter((c) => c.status === "available");
