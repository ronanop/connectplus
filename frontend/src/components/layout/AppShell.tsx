import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AccessGuard } from "./AccessGuard";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../lib/api";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);

  // Load / merge full profile (department, etc.) for access control
  useEffect(() => {
    api
      .get("/api/auth/me")
      .then(response => {
        const userData = response.data?.data?.user;
        if (userData) {
          // Zustand setUser is not a React setState — it must receive an object, not an updater fn.
          const prev = useAuthStore.getState().user;
          setUser(prev ? { ...prev, ...userData } : userData);
        }
      })
      .catch(() => {
        // Unauthenticated or session expired
      });
  }, [setUser]);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.035),_transparent)] px-6 py-6">
          <AccessGuard>{children}</AccessGuard>
        </main>
      </div>
    </div>
  );
}
