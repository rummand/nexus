import Link from "next/link";

export default function NotFound() {
  return (
    <div className="studio-home-main" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%" }}>
      <div className="studio-empty-boards" style={{ maxWidth: 420 }}>
        <strong>Not found</strong>
        <span>That workspace, space or board does not exist.</span>
        <Link href="/" className="ghost-button" style={{ marginTop: 8 }}>Back to the workspace</Link>
      </div>
    </div>
  );
}
