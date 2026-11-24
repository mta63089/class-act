"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type AdminPendingButtonProps = {
  idle: string;
  busy: string;
  className?: string;
  /** Optional override: enables the full-screen generation overlay for this action. */
  generationOverlay?: boolean;
};

const GENERATION_SUBMITTER = "_classActGeneration";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function AdminPendingButton({
  idle,
  busy,
  className = "",
  generationOverlay,
}: AdminPendingButtonProps) {
  const { pending, data } = useFormStatus();
  // Works with existing CMS forms without requiring changes to each call site.
  // Use generationOverlay={true | false} to opt in/out explicitly in new screens.
  const isGeneration = generationOverlay ?? /generat|creat(?:ing|e) draft|revis/i.test(busy);
  // Submitter name prevents the overlay from appearing when the same form's
  // secondary "Save brief for later" button (formAction) is clicked.
  const showOverlay = pending && isGeneration && data?.get(GENERATION_SUBMITTER) === "1";
  const [elapsed, setElapsed] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOverlay) return;
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    overlayRef.current?.focus();
    return () => clearInterval(interval);
  }, [showOverlay]);

  const revising = /revis/i.test(busy);

  return (
    <>
      <button
        type="submit"
        name={isGeneration ? GENERATION_SUBMITTER : undefined}
        value={isGeneration ? "1" : undefined}
        disabled={pending}
        aria-busy={pending}
        className={`border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818] disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        {pending ? busy : idle}
      </button>

      {showOverlay && (
        <div
          ref={overlayRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="generation-progress-title"
          aria-describedby="generation-progress-description"
          className="fixed inset-0 z-[9999] flex min-h-dvh overflow-y-auto bg-ink px-5 py-8 text-paper outline-none sm:px-10"
        >
          <div className="relative mx-auto my-auto w-full max-w-[850px]">
            <header className="mb-12 flex items-center justify-between gap-4 border-b border-paper/30 pb-5">
              <div className="font-display text-xl font-black uppercase tracking-wide sm:text-2xl">
                The Class Act <span className="text-sun">Daily</span>
              </div>
              <span className="border border-paper/40 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] sm:text-xs">
                Newsroom / Private
              </span>
            </header>

            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[.2em] text-sun">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-sun/25 border-t-sun" aria-hidden="true" />
              Request in progress
            </div>

            <h2 id="generation-progress-title" className="mt-6 font-display text-[clamp(3.5rem,10vw,7.5rem)] font-black uppercase leading-[.87] tracking-tight">
              {revising ? (
                <>Reworking <span className="text-sun">your story.</span></>
              ) : (
                <>Building <span className="text-sun">your story.</span></>
              )}
            </h2>
            <p id="generation-progress-description" className="mt-7 max-w-2xl text-base leading-relaxed text-paper/85 sm:text-lg">
              {revising
                ? "Your revision request is being processed. The updated article will be saved as a new version for your review."
                : "Your brief is being researched and turned into a sourced draft. The article will open in the private editor when it is saved."}
            </p>

            <div className="mt-10 grid grid-cols-3 gap-2" aria-hidden="true">
              <div className="h-2 animate-pulse bg-sun" />
              <div className="h-2 animate-pulse bg-lilac [animation-delay:250ms]" />
              <div className="h-2 animate-pulse bg-pop-red [animation-delay:500ms]" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-paper/75">
              <span aria-live="polite">Elapsed: {formatElapsed(elapsed)}</span>
              <span>Waiting for server response</span>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {(revising
                ? [
                    ["01", "Read instructions", "Review your requested changes"],
                    ["02", "Revise writing", "Preserve existing sources"],
                    ["03", "Save revision", "Keep earlier versions intact"],
                  ]
                : [
                    ["01", "Research", "Find sources and relevant evidence"],
                    ["02", "Write", "Draft and cite the article"],
                    ["03", "Save", "Create your private review draft"],
                  ]
              ).map(([number, title, description]) => (
                <div key={number} className="border border-paper/30 p-4">
                  <div className="font-display text-3xl font-black text-sun">{number}</div>
                  <p className="mt-2 text-sm font-black uppercase tracking-wide">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-paper/70">{description}</p>
                </div>
              ))}
            </div>

            <div role="status" aria-live="polite" className="mt-8 border-l-4 border-sun bg-paper/10 px-5 py-4 text-sm text-paper/85">
              {elapsed >= 120
                ? "This is taking longer than usual. The request is still pending; if the server times out, check Story Ideas for the failed request before retrying."
                : elapsed >= 45
                  ? "Still waiting for the server. Source-heavy research can take several minutes."
                  : "These are the workflow stages, not live step-by-step progress. Keep this tab open until the article or an error appears."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
