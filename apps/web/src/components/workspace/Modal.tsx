"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card fade-in" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
