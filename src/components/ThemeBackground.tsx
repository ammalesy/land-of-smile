"use client";

import { useTheme } from "@/context/ThemeContext";

/**
 * Renders the full-screen background layer appropriate for the active theme.
 * Place this as the first child inside any page container.
 */
export function ThemeBackground() {
  const { theme } = useTheme();

  if (theme === "galaxy") {
    return (
      <div className="galaxy-bg" aria-hidden="true">
        <div className="stars-layer stars-tiny" />
        <div className="stars-layer stars-medium" />
        <div className="stars-layer stars-bright" />
        <div className="black-hole" />
      </div>
    );
  }

  if (theme === "msn") {
    return (
      <div className="msn-bg" aria-hidden="true">
        <div className="msn-gradient" />
        <div className="msn-butterfly" aria-hidden="true">🦋</div>
      </div>
    );
  }

  if (theme === "neon") {
    return (
      <div className="neon-bg" aria-hidden="true">
        <div className="neon-grid" />
        <div className="neon-glow neon-glow-1" />
        <div className="neon-glow neon-glow-2" />
      </div>
    );
  }

  if (theme === "sakura") {
    return (
      <div className="sakura-bg" aria-hidden="true">
        <div className="sakura-petal sakura-p1">🌸</div>
        <div className="sakura-petal sakura-p2">🌸</div>
        <div className="sakura-petal sakura-p3">🌸</div>
        <div className="sakura-petal sakura-p4">🌸</div>
        <div className="sakura-petal sakura-p5">🌸</div>
        <div className="sakura-petal sakura-p6">🌸</div>
      </div>
    );
  }

  // Fallback — transparent
  return null;
}
