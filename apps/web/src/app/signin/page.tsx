import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { NexusMark } from "@/components/workspace/NexusMark";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session-store";
import { SESSION_COOKIE, currentUserOrNull } from "@/lib/session";
import { demoSignInHint } from "@/lib/auth/demo";

/**
 * Sign in as yourself (§5.41).
 *
 * One form, and three things it is careful about:
 *
 * - **It never says which half was wrong.** "No account with that address" is a way to find out
 *   who has an account, and this product knows who works at an organisation.
 * - **It costs the same either way.** An address with no user still goes through a hash, so the
 *   response time does not answer the question the message refuses to.
 * - **It only sends you back to this site.** `?next=` is attacker-controlled text.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  // Already signed in: this page has nothing to offer.
  if (await currentUserOrNull()) redirect(safeNext(next ?? "") || "/");
  const hint = await demoSignInHint();

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const target = safeNext(String(formData.get("next") ?? ""));
    const fail = () => redirect(`/signin?error=1${target ? `&next=${encodeURIComponent(target)}` : ""}`);

    const db = await getDb();
    const user = email ? await db.query.users.findFirst({ where: eq(s.users.email, email) }) : undefined;

    /*
     * Hash something even when there is no such user. Without this, "no account" returns in a
     * millisecond and "wrong password" in three hundred, and the form answers a question it was
     * written not to answer.
     */
    const ok = await verifyPassword(password, user?.passwordHash ?? DECOY);
    if (!user || !ok) fail();

    // Signing in is a good moment to quietly move an old hash to the current cost.
    if (needsRehash(user!.passwordHash)) {
      await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, user!.id));
    }

    const token = await createSession(db, user!.id, (await headers()).get("user-agent") ?? undefined);
    (await cookies()).set(SESSION_COOKIE, token, {
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
        <h1>Sign in to Nexus</h1>
        <p>The model is an organisation&rsquo;s view of itself, so it knows who wrote what.</p>
        <input type="hidden" name="next" value={next ?? ""} />
        <label>
          <span>Email</span>
          <input name="email" type="email" autoFocus required autoComplete="username" aria-label="Email" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" required autoComplete="current-password" aria-label="Password" />
        </label>
        {error && <p className="form-error" role="alert">That email and password do not match.</p>}
        <button type="submit" className="primary-home-button">Sign in</button>
        {hint && (
          <p className="signin-hint" data-demo-hint>
            <b>Demo instance.</b> Sign in as <code>{hint.email}</code> with <code>{hint.password}</code>
            {hint.others.length > 0 && <> — or as {hint.others.map((o) => <code key={o}>{o}</code>).reduce((a, b) => <>{a}, {b}</>)}, same password.</>}
          </p>
        )}
      </form>
    </main>
  );
}

/**
 * A real hash of a value nobody knows, so the no-such-user path does the same work as the rest.
 * It can never match: `verifyPassword` is given this only when there is no user to match.
 */
const DECOY = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Only allow same-site paths back, so ?next= cannot bounce someone to another origin. */
function safeNext(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}
