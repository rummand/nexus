import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { dismissDigest } from "@/lib/agent/digest";
import { currentUserOrNull } from "@/lib/session";

/**
 * Mark the digest read (§5.42).
 *
 * A POST, and the only thing that moves the window: reading is not dismissing, so a glance on a
 * phone does not cost somebody the digest they meant to read properly at a desk.
 */
export async function POST() {
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  await dismissDigest(await getDb(), user.id);
  return new Response(null, { status: 204 });
}
