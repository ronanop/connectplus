import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { ArrowLeft, CheckCircle2, ClipboardList, LogOut, UserRound } from "lucide-react";
import { api } from "./lib/api";
import { AuthUser, useAuthStore } from "./stores/authStore";

type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | string;

type MobileTask = {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: TaskStatus;
  skillTag: string | null;
  dueDate: string | null;
  createdAt: string;
  project: {
    id: number;
    name: string;
    customer: string;
  };
  assignedTo: {
    id: number;
    name: string;
    email: string;
  } | null;
  updatesCount?: number;
};

type TaskDetail = MobileTask & {
  updates: Array<{
    id: number;
    updateText: string;
    evidenceUrl: string | null;
    submittedAt: string;
    validationStatus: string | null;
    feedback: string | null;
    member: {
      id: number;
      name: string;
      email: string;
    };
  }>;
};

type TeamTask = MobileTask & {
  projectTeam: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
};

function formatTaskDate(dateString: string | null) {
  if (!dateString) return "No due date";
  return new Date(dateString).toLocaleDateString();
}

function roleCanAllocate(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "MANAGEMENT";
}

function resolveMicrosoftRedirectUri() {
  const configuredBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configuredBaseUrl && configuredBaseUrl.trim()) {
    return `${configuredBaseUrl.replace(/\/+$/, "")}/login`;
  }
  return `${window.location.origin}/login`;
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const clearUser = useAuthStore(s => s.clearUser);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/logout");
    },
    onSettled: () => {
      clearUser();
      navigate("/login");
    },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[var(--bg-base)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Connectplus CRM Mobile
            </p>
            <h1 className="mt-1 text-lg font-semibold">{title}</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {user && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--accent-primary)]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name || "User"}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {user.email || user.role}
              </p>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore(s => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/api/auth/login", { email, password });
      return response.data?.data?.user as AuthUser | undefined;
    },
    onSuccess: async () => {
      const meResponse = await api.get("/api/auth/me");
      const user = meResponse.data?.data?.user as AuthUser;
      setUser(user);
      navigate("/tasks", { replace: true });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? "Login failed");
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const ssoError = urlParams.get("error");

    if (ssoError) {
      setError(`Microsoft authentication error: ${ssoError}`);
      window.history.replaceState({}, document.title, "/login");
      return;
    }

    if (code) {
      void handleMicrosoftCallback(code);
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const handleMicrosoftCallback = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      const codeVerifier = sessionStorage.getItem("msal_code_verifier");
      const redirectUri = resolveMicrosoftRedirectUri();

      if (!codeVerifier) {
        setError("Code verifier not found. Please try again.");
        setLoading(false);
        return;
      }

      await api.post("/api/auth/login/microsoft/callback", {
        code,
        codeVerifier,
        redirectUri,
      });

      sessionStorage.removeItem("msal_code_verifier");

      const meResponse = await api.get("/api/auth/me");
      const user = meResponse.data?.data?.user as AuthUser | undefined;
      if (!user) {
        setError("Unexpected response from server.");
        setLoading(false);
        return;
      }

      setUser(user);
      navigate("/tasks", { replace: true });
    } catch (callbackError) {
      if (axios.isAxiosError(callbackError)) {
        const status = callbackError.response?.status;
        if (status === 401 || status === 403) {
          setError("Microsoft authentication failed. Please ensure your account has access.");
        } else if (status && status >= 500) {
          setError("Server error while signing in. Please try again.");
        } else {
          setError("Unable to sign in with Microsoft. Please try again.");
        }
      } else {
        setError("Unexpected error while signing in.");
      }
      setLoading(false);
    }
  };

  const handleMicrosoftSSO = async () => {
    const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
    const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
    const redirectUri = resolveMicrosoftRedirectUri();

    if (!tenantId || !clientId) {
      setError("Microsoft SSO not configured. Please contact administrator.");
      return;
    }

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const isSecureOrigin = window.isSecureContext || window.location.protocol === "https:";
    if (!isSecureOrigin && !isLocalhost) {
      setError(
        "Microsoft SSO requires HTTPS or localhost. Open this app on HTTPS, or set VITE_PUBLIC_APP_URL to a registered HTTPS login URL."
      );
      return;
    }

    if (!window.crypto?.subtle) {
      setError(
        "This browser context cannot generate the Microsoft PKCE challenge. Use HTTPS or localhost for SSO."
      );
      return;
    }

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      sessionStorage.setItem("msal_code_verifier", codeVerifier);

      const authUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_mode=query&` +
        `scope=User.Read&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256&` +
        `prompt=select_account`;

      window.location.href = authUrl;
    } catch (ssoError) {
      const message = ssoError instanceof Error ? ssoError.message : "";
      if (message) {
        setError(`Failed to initiate Microsoft login: ${message}`);
      } else {
        setError("Failed to initiate Microsoft login. Please try again.");
      }
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Connectplus CRM Mobile
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Task-first workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Sign in to manage tasks, updates, and allocations from the same backend used by the full CRM.
        </p>

        <button
          type="button"
          onClick={() => void handleMicrosoftSSO()}
          disabled={loading || loginMutation.isPending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] disabled:opacity-70"
        >
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
          <span>Sign in with Microsoft</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg-surface)] px-2 text-[var(--text-muted)]">or</span>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loginMutation.isPending || loading}
            className="w-full rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-70"
          >
            {loginMutation.isPending || loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TasksPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canAllocate = roleCanAllocate(user?.role);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-my-tasks", statusFilter],
    queryFn: async () => {
      const query = statusFilter === "ALL" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await api.get(`/api/tasks/my${query}`);
      return response.data?.data?.tasks as MobileTask[];
    },
  });

  const tasks = data ?? [];

  return (
    <Shell
      title="My Tasks"
      subtitle={canAllocate ? "Track your work and jump into team allocation when needed." : "Track status and send quick daily updates."}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
          {["ALL", "TODO", "IN_PROGRESS"].map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                statusFilter === option
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-base)] text-[var(--text-primary)]"
              }`}
            >
              {option === "IN_PROGRESS" ? "Active" : option}
            </button>
          ))}
        </div>

        {canAllocate && (
          <button
            type="button"
            onClick={() => navigate("/tasks/team")}
            className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4 text-left shadow-sm"
          >
            <div>
              <p className="text-sm font-medium">Task Allocation</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Assign or reassign work across your team.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-[var(--accent-primary)]" />
          </button>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            No tasks found for the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {task.project.name} · {task.project.customer}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {task.description || "No description provided."}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold text-[var(--text-primary)]">
                    {task.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{task.priority} priority</span>
                  <span>{formatTaskDate(task.dueDate)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function TaskDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const taskId = Number(id);
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [updateText, setUpdateText] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: ["mobile-task-detail", taskId],
    enabled: Number.isFinite(taskId),
    queryFn: async () => {
      const response = await api.get(`/api/tasks/${taskId}`);
      return response.data?.data?.task as TaskDetail;
    },
  });

  useEffect(() => {
    if (task) {
      setStatus(task.status);
    }
  }, [task]);

  const statusMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/tasks/${taskId}/status`, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-task-detail", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-my-tasks"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/tasks/${taskId}/updates`, { updateText });
    },
    onSuccess: async () => {
      setUpdateText("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-task-detail", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-my-tasks"] });
    },
  });

  if (isLoading || !task) {
    return (
      <Shell title="Task Detail" subtitle="Loading task information">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Loading task...
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Task Detail" subtitle={task.project.name}>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
        </button>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{task.title}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {task.project.customer} · {task.priority} priority
              </p>
            </div>
            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold">
              {task.status.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {task.description || "No description provided."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
            <div className="rounded-xl bg-[var(--bg-base)] px-3 py-3">Due: {formatTaskDate(task.dueDate)}</div>
            <div className="rounded-xl bg-[var(--bg-base)] px-3 py-3">
              Assigned to: {task.assignedTo?.name || "Unassigned"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <p className="text-sm font-semibold">Update Status</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-xl px-3 py-3 text-xs font-medium ${
                  status === option ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-base)]"
                }`}
              >
                {option.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => statusMutation.mutate()}
            disabled={statusMutation.isPending}
            className="mt-3 w-full rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-70"
          >
            {statusMutation.isPending ? "Saving..." : "Save status"}
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <p className="text-sm font-semibold">Daily Update</p>
          <textarea
            value={updateText}
            onChange={event => setUpdateText(event.target.value)}
            placeholder="Share progress, blockers, or next steps."
            rows={4}
            className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
          />
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || updateText.trim().length === 0}
            className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-medium disabled:opacity-70"
          >
            {updateMutation.isPending ? "Posting..." : "Submit update"}
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <p className="text-sm font-semibold">Recent Updates</p>
          <div className="mt-3 space-y-3">
            {task.updates.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No updates yet.</p>
            ) : (
              task.updates.map(update => (
                <div key={update.id} className="rounded-2xl bg-[var(--bg-base)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">{update.member.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formatDistanceToNow(new Date(update.submittedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-primary)]">{update.updateText}</p>
                  {update.validationStatus && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                      <CheckCircle2 className="h-3 w-3" />
                      {update.validationStatus}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TeamTasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-team-tasks"],
    enabled: roleCanAllocate(user?.role),
    queryFn: async () => {
      const response = await api.get("/api/tasks/team");
      return response.data?.data?.tasks as TeamTask[];
    },
  });

  const tasks = data ?? [];
  const selectedTask = useMemo(
    () => tasks.find(task => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTaskId) return;
      await api.patch(`/api/tasks/${selectedTaskId}/assign`, {
        assignedToId: assigneeId ? Number(assigneeId) : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-team-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-my-tasks"] });
    },
  });

  if (!roleCanAllocate(user?.role)) {
    return <Navigate to="/tasks" replace />;
  }

  return (
    <Shell title="Task Allocation" subtitle="Assign and rebalance work from the same shared backend.">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my tasks
        </button>

        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            Loading team tasks...
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setSelectedTaskId(task.id);
                  setAssigneeId(task.assignedTo?.id ? String(task.assignedTo.id) : "");
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm ${
                  selectedTaskId === task.id
                    ? "border-[var(--accent-primary)] bg-[var(--bg-surface)]"
                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {task.project.name} · {task.status.replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Current owner: {task.assignedTo?.name || "Unassigned"}
                </p>
              </button>
            ))}
          </div>
        )}

        {selectedTask && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <p className="text-sm font-semibold">Assign Task</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{selectedTask.title}</p>
            <select
              value={assigneeId}
              onChange={event => setAssigneeId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">Unassigned</option>
              {selectedTask.projectTeam.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
              className="mt-3 w-full rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-70"
            >
              {assignMutation.isPending ? "Saving..." : "Save assignment"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function AuthBoot() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then(response => {
        const currentUser = response.data?.data?.user as AuthUser | undefined;
        if (currentUser) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        // Ignore boot errors, route guards will handle login.
      })
      .finally(() => setReady(true));
  }, [setUser]);

  if (!ready) {
    return <div className="p-6 text-center text-sm text-[var(--text-muted)]">Loading mobile workspace...</div>;
  }

  return <Navigate to={user ? "/tasks" : "/login"} replace />;
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const user = useAuthStore(s => s.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthBoot />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ProtectedRoute>
            <TaskDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/team"
        element={
          <ProtectedRoute>
            <TeamTasksPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
