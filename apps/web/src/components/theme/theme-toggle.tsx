import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { readTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(readTheme()), []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(toggleTheme())}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? (
        <IconSun size={18} stroke={1.75} aria-hidden />
      ) : (
        <IconMoon size={18} stroke={1.75} aria-hidden />
      )}
    </button>
  );
}
