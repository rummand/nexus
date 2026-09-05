import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";
import { NexusMark } from "@/components/workspace/NexusMark";

/**
 * Shared-password login for a deployed instance. Only reachable when NEXUS_ACCESS_PASSWORD is
 * set; without it the middleware never redirects here and this page sends you to the workspace.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (!process.env.NEXUS_ACCESS_PASSWORD) redirect("/");

  async function signIn(formData: FormData) {
    "use server";
    const password = process.env.NEXUS_ACCESS_PASSWORD;
    if (!password) redirect("/");
    const supplied = String(formData.get("password") ?? "");
    const target = safeNext(String(formData.get("next") ?? ""));
    if (supplied !== password) redirect(`/login?error=1${target ? `&next=${encodeURIComponent(target)}` : ""}`);
    (await cookies()).set(ACCESS_COOKIE, await accessToken(password), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(target || "/");
  }

  return (
    <main className="login-shell">
      <form className="login-card" action={signIn}>
        <span className="brand-mark" aria-hidden><NexusMark /></span>
        <h1>Nexus</h1>
        <p>This instance is password protected. Ask the workspace owner for the access password.</p>
        <input type="hidden" name="next" value={next ?? ""} />
        <label>
          <span>Access password</span>
          <input name="password" type="password" autoFocus required autoComplete="current-password" aria-label="Access password" />
        </label>
        {error && <p className="form-error" role="alert">That password is not right.</p>}
        <button type="submit" className="primary-home-button">Enter</button>
      </form>
    </main>
  );
}

/** Only allow same-site paths back, so ?next= cannot bounce someone to another origin. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}
