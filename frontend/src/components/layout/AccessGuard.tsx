import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { canAccessPath } from "../../lib/accessControl";

export function AccessGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !canAccessPath(location.pathname, user)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  if (user && !canAccessPath(location.pathname, user)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-8 text-center text-sm text-amber-950">
        You don&apos;t have access to this area for your role or department.
        <p className="mt-2 text-xs text-amber-800/90">Redirecting to the dashboard…</p>
      </div>
    );
  }

  return <>{children}</>;
}
