"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme, type ColorMode } from "@/lib/theme";

const MODES: { id: ColorMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function SiteHeader() {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = mounted ? theme : "system";

  const menu = (
    <div
      ref={menuRef}
      id={menuId}
      className={`menu-slot${open ? " open" : ""}`}
      aria-hidden={!open}
    >
      <nav className="menu-panel" aria-label="Site">
        <a className="menu-link current" href="/">
          hyperliquid board
        </a>
        <div className="menu-item">
          <p className="menu-item-label">Appearance</p>
          <div className="theme-switch" role="group" aria-label="Color mode">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active === mode.id}
                className={active === mode.id ? "on" : undefined}
                onClick={() => setTheme(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <header className="site-header">
      <div className="site-header-bar" aria-hidden="true" />
      <div className="site-header-inner">
        <a className="brand" href="/">
          bagrank
        </a>
        <div className={`menu-wrap${open ? " open" : ""}`} ref={wrapRef}>
          <button
            type="button"
            className="hamburger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      {mounted ? createPortal(menu, document.body) : null}
    </header>
  );
}
