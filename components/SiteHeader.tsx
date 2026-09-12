"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTheme, type ColorMode } from "@/lib/theme";

const MODES: { id: ColorMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function XMark() {
  return (
    <svg className="menu-x" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.1 10.3 22.2 1h-2.3l-6.9 8-5.5-8H1.2l8.5 12.3L1.2 23h2.3l7.4-8.6L16.8 23h6.3l-9-12.7ZM5 2.6h3.5l10.4 18.8h-3.5L5 2.6Z"
      />
    </svg>
  );
}

export function SiteHeader() {
  const menuId = useId();
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        <a
          className={`menu-link${pathname === "/" ? " current" : ""}`}
          href="/"
        >
          hyperliquid board
        </a>
        <a
          className={`menu-link${pathname === "/about" ? " current" : ""}`}
          href="/about"
        >
          about
        </a>
        <a
          className="menu-link menu-social"
          href="https://x.com/JohnYi0x"
          target="_blank"
          rel="noreferrer"
        >
          <XMark />
          JohnYi0x
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
