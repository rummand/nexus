import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-ink-500">That workspace, room or board does not exist.</p>
      <Link href="/" className="text-sm text-accent-700 hover:underline">Back to the workspace</Link>
    </div>
  );
}
