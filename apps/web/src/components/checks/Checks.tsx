import Link from "next/link";
import { CircleAlert, CircleCheck, Info, ShieldCheck } from "lucide-react";
import type { CheckResult, Finding } from "@/lib/checks/suite";
import type { RefChecks } from "@/lib/checks/run";
import { newFindings, fixedFindings, verdict } from "@/lib/checks/suite";
import type { Ref } from "@/lib/change/ref";
import { refName } from "@/lib/change/ref";

/**
 * The model's test suite, as a page (§5.83).
 *
 * Estate health answers *how are we doing* with a score. This answers *may this land*, which is a
 * different question and the one a merge has to ask. So it is a list of checks with verdicts and
 * the rows behind each, not a dashboard: every failure is a link to the object that failed it.
 */

function FindingRows({ slug, findings }: { slug: string; findings: Finding[] }) {
  const shown = findings.slice(0, 25);
  return (
    <>
      <ul className="check-findings">
        {shown.map((f) => (
          <li key={`${f.checkId}:${f.subjectId}:${f.detail}`} data-finding={f.checkId}>
            {/* Addressable, always: a finding you cannot click is a finding nobody acts on. */}
            <Link href={`/w/${slug}/fs/${f.subjectId}`}>{f.subjectName || "(unnamed)"}</Link>
            <span>{f.detail}</span>
          </li>
        ))}
      </ul>
      {findings.length > shown.length && (
        <p className="check-more">…and {findings.length - shown.length} more.</p>
      )}
    </>
  );
}

function CheckCard({ slug, check, added }: { slug: string; check: CheckResult; added: Set<string> }) {
  const isNew = (f: Finding) => added.has(`${f.checkId}::${f.subjectId}::${f.detail}`);
  const newly = check.findings.filter(isNew);
  return (
    <section className={`check${check.passed ? " ok" : check.severity === "blocking" ? " blocking" : " advisory"}`} data-check={check.id}>
      <header>
        {check.passed ? <CircleCheck size={15} /> : check.severity === "blocking" ? <CircleAlert size={15} /> : <Info size={15} />}
        <div>
          <h2>{check.title}</h2>
          <p>{check.goal}</p>
        </div>
        <span className="check-verdict" data-check-verdict={check.passed ? "pass" : "fail"}>
          {check.passed ? "passing" : `${check.findings.length}`}
          {!check.passed && newly.length > 0 && <b> · {newly.length} new</b>}
        </span>
      </header>
      {!check.passed && <FindingRows slug={slug} findings={[...newly, ...check.findings.filter((f) => !isNew(f))]} />}
    </section>
  );
}

export function Checks({ slug, at, result }: { slug: string; at: Ref; result: RefChecks }) {
  const { head, base, onMain } = result;
  const added = onMain ? [] : newFindings(base, head);
  const fixed = onMain ? [] : fixedFindings(base, head);
  const v = verdict(added);
  const addedKeys = new Set(added.map((f) => `${f.checkId}::${f.subjectId}::${f.detail}`));

  return (
    <div className="studio-home-main checks" data-checks>
      <div className="studio-home-topbar">
        <div>
          <span>The model&rsquo;s own test suite</span>
          <h1>Checks</h1>
        </div>
      </div>

      <section className={`check-summary${onMain ? "" : v.ok ? " ok" : " bad"}`} data-check-summary>
        <ShieldCheck size={18} />
        <div>
          {onMain ? (
            <>
              <strong data-check-headline>
                {head.passed ? "Nothing blocking on main" : `${head.blocking} blocking check${head.blocking === 1 ? "" : "s"} failing on main`}
              </strong>
              <p>
                {head.findings.length} finding{head.findings.length === 1 ? "" : "s"} across {head.checks.length} checks,
                over {head.checked} objects and relations. A repository this size is never clean;
                what matters is whether a change makes it worse — stand on a change set to see that.
              </p>
            </>
          ) : (
            <>
              <strong data-check-headline>{v.words}</strong>
              <p>
                Against <b>main</b>, standing on <b>{refName(at)}</b>.
                {fixed.length > 0 && <> It also repairs {fixed.length} existing finding{fixed.length === 1 ? "" : "s"}.</>}
                {" "}The question a merge asks is not whether the model is clean — it is not — but
                whether this makes it worse.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="check-list">
        {head.checks.map((check) => <CheckCard key={check.id} slug={slug} check={check} added={addedKeys} />)}
      </div>
    </div>
  );
}
