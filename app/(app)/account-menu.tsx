"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal, Settings } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function AccountMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return <div className="account-menu" ref={menuRef}>
    <button
      className="account-menu-trigger"
      type="button"
      aria-label="Account options"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <MoreHorizontal size={19} />
    </button>
    {open && <div className="account-menu-panel" role="menu">
      {isAdmin && <Link href="/settings" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
        <Settings size={16} />Configuration
      </Link>}
      <form action={logoutAction}>
        <button className="account-menu-item" role="menuitem">
          <LogOut size={16} />Log out
        </button>
      </form>
    </div>}
  </div>;
}
