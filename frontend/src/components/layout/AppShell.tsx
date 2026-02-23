import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useThemeStore } from "../../stores/themeStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);

  useEffect(() => {
    setTheme(theme);
  }, []);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.035),_transparent)] px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
