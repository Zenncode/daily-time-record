"use client";

import { useEffect, useRef, useState } from "react";
import { requestCorrectionAction } from "@/app/actions/attendance";

export function CorrectionRequest({ attendanceId, hasClockOut }: { attendanceId: string; hasClockOut: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = `correction-title-${attendanceId}`;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeModal() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="correction-trigger"
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      Request change
    </button>
    {open && <div className="correction-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeModal();
    }}>
      <section className="correction-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="correction-modal-header">
          <div>
            <p className="eyebrow">ATTENDANCE</p>
            <h2 id={titleId}>Request a correction</h2>
            <p className="correction-modal-description">Tell your manager what needs to be updated.</p>
          </div>
          <button type="button" className="correction-modal-close" onClick={closeModal} aria-label="Close correction request">×</button>
        </div>
        <form action={requestCorrectionAction} className="correction-form">
          <input type="hidden" name="attendanceId" value={attendanceId} />
          <div className="field">
            <label htmlFor={`correction-type-${attendanceId}`}>What needs correcting?</label>
            <select className="select" id={`correction-type-${attendanceId}`} name="type" required>
              <option value="CLOCK_IN">Clock-in time</option>
              {hasClockOut && <option value="CLOCK_OUT">Clock-out time</option>}
              <option value="BREAK_TOTAL">Total break time</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`correction-time-${attendanceId}`}>Correct time (if changing a punch)</label>
            <input className="input" id={`correction-time-${attendanceId}`} type="datetime-local" name="requestedAt" />
          </div>
          <div className="field">
            <label htmlFor={`correction-break-${attendanceId}`}>Break minutes (if correcting break)</label>
            <input className="input" id={`correction-break-${attendanceId}`} type="number" name="requestedBreak" min="0" max="1440" />
          </div>
          <div className="field">
            <label htmlFor={`correction-reason-${attendanceId}`}>Reason</label>
            <textarea className="textarea" id={`correction-reason-${attendanceId}`} name="reason" minLength={5} maxLength={500} required />
          </div>
          <button className="button button-primary correction-submit">Send request</button>
        </form>
      </section>
    </div>}
  </>;
}
