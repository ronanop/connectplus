import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Plus, UserCircle } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { canUserAssignTasks } from "../../lib/taskHierarchy";
import { MOBILE_DEFAULT_HOME_PATH, navLinkIsActive } from "@shared/workspaceNav";

function itemClass(active: boolean) {
  return `mobile-tap flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold transition-colors ${
    active ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
  }`;
}

/**
 * Single bottom shortcut bar for the whole authenticated app.
 * Rendered with createPortal(document.body) so #root / overflow cannot hide it.
 * z-index below full-screen overlays (menu/notifications at 110), above page chrome.
 */
export function MobileBottomDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const tasksActive = navLinkIsActive("/tasks/hierarchy", location.pathname);
  const profileActive = navLinkIsActive("/profile", location.pathname);
  const canQuickAssign = Boolean(user?.role && canUserAssignTasks(user.role));

  const node = (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex justify-center lg:hidden"
      aria-label="Primary shortcuts"
      data-mobile-bottom-dock="true"
    >
      <div
        className="w-full max-w-md"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--bg-surface)",
          borderTop: "2px solid var(--border)",
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))",
          paddingTop: "0.5rem",
          boxShadow: "0 -8px 32px rgba(10, 15, 30, 0.14)",
        }}
      >
        <div className="relative flex h-14 items-center justify-between px-5">
          <NavLink
            to={MOBILE_DEFAULT_HOME_PATH}
            className={() => itemClass(tasksActive)}
            aria-current={tasksActive ? "page" : undefined}
          >
            <LayoutGrid className="h-6 w-6" strokeWidth={tasksActive ? 2.5 : 2} />
            <span>Tasks</span>
          </NavLink>
          <NavLink
            to="/profile"
            className={() => itemClass(profileActive)}
            aria-current={profileActive ? "page" : undefined}
          >
            <UserCircle className="h-6 w-6" strokeWidth={profileActive ? 2.5 : 2} />
            <span>Profile</span>
          </NavLink>
          <button
            type="button"
            onClick={() => {
              if (canQuickAssign) {
                navigate(`${MOBILE_DEFAULT_HOME_PATH}?assign=1`);
              } else {
                navigate(MOBILE_DEFAULT_HOME_PATH);
              }
            }}
            className="mobile-tap mobile-tap-strong absolute left-1/2 top-0 z-10 flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 -translate-y-[42%] items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-lg ring-[5px] ring-[var(--bg-base)]"
            aria-label={canQuickAssign ? "Assign task" : "Open task board"}
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(node, document.body);
}
