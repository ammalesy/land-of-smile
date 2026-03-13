import type { ThemeId } from "@/types";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  emoji: string;
  description: string;
  /** CSS gradient string used for the preview swatch */
  preview: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "galaxy",
    name: "Galaxy",
    emoji: "🌌",
    description: "Dark space — stars & black hole",
    preview: "linear-gradient(135deg, #04000f 0%, #0d0030 50%, #090018 100%)",
  },
  {
    id: "msn",
    name: "MSN",
    emoji: "🦋",
    description: "Classic MSN Messenger retro vibes",
    preview: "linear-gradient(160deg, #1e6ec8 0%, #5ba3e8 45%, #7fcef4 100%)",
  },
  {
    id: "neon",
    name: "Neon",
    emoji: "⚡",
    description: "Cyberpunk neon glow in the dark",
    preview: "linear-gradient(135deg, #060010 0%, #1a004d 50%, #003310 100%)",
  },
  {
    id: "sakura",
    name: "Sakura",
    emoji: "🌸",
    description: "Soft pink cherry blossom garden",
    preview: "linear-gradient(135deg, #fff0f6 0%, #ffd6e8 50%, #ffc2dd 100%)",
  },
];

export const DEFAULT_THEME: ThemeId = "galaxy";

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
