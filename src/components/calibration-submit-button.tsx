"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function CalibrationSubmitButton({
  stage,
}: {
  stage: "research" | "writing";
}) {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const start = Date.now();
    const handle = setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(handle);
  }, [pending]);
  const title =
    stage === "research" ? "Researching sources" : "Writing the article";
  return (
    <>
      <button
        type='submit'
        disabled={pending}
        className='border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818] disabled:cursor-wait'
      >
        {pending
          ? "Request in progress…"
          : stage === "research"
            ? "Authorize research call"
            : "Authorize writing call"}
      </button>
      {pending && (
        <div
          role='dialog'
          aria-modal='true'
          aria-labelledby='calibration-title'
          className='fixed inset-0 z-9999 flex items-center justify-center bg-ink p-5 text-paper'
        >
          <div className='w-full max-w-2xl border-2 border-paper/40 p-8'>
            <p className='text-xs font-black uppercase tracking-widest text-sun'>
              The Class Act Daily / Calibration
            </p>
            <h2
              id='calibration-title'
              className='mt-5 font-display text-5xl font-black uppercase'
            >
              {title}
            </h2>
            <div className='mt-6 h-2 overflow-hidden bg-paper/20'>
              <div className='h-full w-1/3 animate-pulse bg-sun' />
            </div>
            <p className='mt-6 text-sm'>
              Elapsed: {Math.floor(seconds / 60)}:
              {String(seconds % 60).padStart(2, "0")}
            </p>
            <p className='mt-3 text-sm text-paper/80'>
              One API request for this stage only. This is activity feedback,
              not a percentage or confirmed sub-step. Results and costs will
              appear when the request returns.
            </p>
            {seconds >= 120 && (
              <p className='mt-5 border-l-4 border-sun pl-4 text-sm'>
                Still waiting for the API. If this screen errors or times out,
                check the calibration record before retrying—an incomplete
                request may still be billed.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
