"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const accounts = [
  { role: "Administrator", email: "admin@dtr.com" },
  { role: "Manager", email: "manager@dtr.com" },
  { role: "Employee", email: "employee1@dtr.com" },
  { role: "Employee", email: "employee2@dtr.com" },
];

export default function DemoAccountsModal() {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return <>
    <button className="button button-outline demo-accounts-trigger" type="button" onClick={() => setOpen(true)}>
      Demo accounts
    </button>
    {open && <div className="demo-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
        <div className="demo-modal-header">
          <div>
            <p className="eyebrow">QUICK ACCESS</p>
            <h2 id="demo-modal-title">Demo accounts</h2>
          </div>
          <button className="demo-modal-close" type="button" aria-label="Close demo accounts" ref={closeButton} onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="demo-modal-description">Use any account below to explore the DTR system.</p>
        <div className="demo-accounts-list">
          {accounts.map((account) => <div className="demo-account" key={account.email}>
            <div className="demo-account-heading">
              <span className="demo-account-role">{account.role}</span>
              <span className="demo-account-email">{account.email}</span>
            </div>
            <div className="demo-account-password"><span>Password</span><code>123456</code></div>
          </div>)}
        </div>
        <p className="demo-modal-note">Demo credentials are for local testing only.</p>
      </section>
    </div>}
  </>;
}
