"use client";

import { AlertTriangle, ArrowRight, Check, Minus } from "lucide-react";
import type { StageReport } from "@/lib/intake/types";

/**
 * The run, drawn as a flow.
 *
 * An import that reports "23 objects imported" is unarguable in the bad sense — there is nothing
 * to disagree with. Drawing the stages, each with what went in, what came out and what it did,
 * turns the extraction into something a person can inspect and blame.
 */
export function PipelineFlow({ stages, running }: { stages: StageReport[]; running: boolean }) {
  if (stages.length === 0) {
    return (
      <div className="pipeline-flow empty">
        <p>Nothing has been read yet. Run the pipeline to see what this source contains.</p>
      </div>
    );
  }
  return (
    <div className={`pipeline-flow ${running ? "running" : ""}`} data-pipeline-flow>
      {stages.map((stage, i) => (
        <div className="pipeline-step" key={stage.id}>
          <div className={`pipeline-stage ${stage.status}`} data-stage={stage.id}>
            <header>
              <span className="pipeline-stage-name">{stage.name}</span>
              {stage.status === "ok" && <Check size={12} />}
              {stage.status === "empty" && <Minus size={12} />}
              {stage.status === "error" && <AlertTriangle size={12} />}
            </header>
            <strong>{stage.out.toLocaleString("en")}</strong>
            <p>{stage.detail}</p>
            <small>{stage.ms} ms</small>
          </div>
          {i < stages.length - 1 && <ArrowRight className="pipeline-arrow" size={14} />}
        </div>
      ))}
    </div>
  );
}
