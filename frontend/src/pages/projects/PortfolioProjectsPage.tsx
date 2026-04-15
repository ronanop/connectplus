import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import {
  FolderKanban,
  Plus,
  Search,
  X,
  Users,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import {
  portfolioArtifactFileUrl,
  portfolioProjectsApi,
  type PortfolioDiscipline,
  type PortfolioKind,
  type PortfolioMemberRole,
  type PortfolioProjectDetail,
  type PortfolioProjectListItem,
  type PortfolioStatus,
} from "../../lib/portfolioProjectsApi";
import { portfolioProjectKeys } from "../../lib/queryKeys";
import { hierarchyTasksApi } from "../../lib/hierarchyTasksApi";

const STATUSES: PortfolioStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "BLOCKED",
  "ON_HOLD",
  "DONE",
  "CANCELLED",
];

const KINDS: PortfolioKind[] = ["INTERNAL", "CLIENT_POC", "CLIENT_PROJECT"];

const DISCIPLINES: PortfolioDiscipline[] = ["CLOUD", "SOFTWARE"];

function statusLabel(s: PortfolioStatus): string {
  return s.replace(/_/g, " ");
}

function kindLabel(kind: PortfolioKind, clientName: string | null): string {
  if (kind === "INTERNAL") {
    return "Internal";
  }
  if (kind === "CLIENT_POC") {
    return `Client POC · ${clientName ?? "Client"}`;
  }
  return `Client project · ${clientName ?? "Client"}`;
}

function kindFilterLabel(k: PortfolioKind): string {
  if (k === "INTERNAL") {
    return "Internal";
  }
  if (k === "CLIENT_POC") {
    return "Client POC";
  }
  return "Client project";
}

function needsClientNameKind(kind: PortfolioKind): boolean {
  return kind === "CLIENT_POC" || kind === "CLIENT_PROJECT";
}

export default function PortfolioProjectsPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const params = useParams();
  const projectIdParam = params.projectId ? parseInt(params.projectId, 10) : NaN;
  const queryClient = useQueryClient();

  const [kindFilter, setKindFilter] = useState<PortfolioKind | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<PortfolioStatus | "ALL">("ALL");
  const [disciplineFilter, setDisciplineFilter] = useState<PortfolioDiscipline | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createIntent, setCreateIntent] = useState<"new" | "existing">("new");
  const [tab, setTab] = useState<"overview" | "team" | "artifacts" | "updates" | "activity">("overview");

  const selectedId = Number.isFinite(projectIdParam) ? projectIdParam : null;
  const setSelected = useCallback(
    (id: number | null) => {
      if (id == null) {
        navigate("/projects/portfolio");
      } else {
        navigate(`/projects/portfolio/${id}`);
      }
    },
    [navigate],
  );

  const listParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (kindFilter !== "ALL") {
      p.kind = kindFilter;
    }
    if (statusFilter !== "ALL") {
      p.status = statusFilter;
    }
    if (disciplineFilter !== "ALL") {
      p.discipline = disciplineFilter;
    }
    if (search.trim()) {
      p.search = search.trim();
    }
    return p;
  }, [kindFilter, statusFilter, disciplineFilter, search]);

  const accessQuery = useQuery({
    queryKey: portfolioProjectKeys.access(),
    queryFn: () => portfolioProjectsApi.getAccess(),
  });

  const listQuery = useQuery({
    queryKey: portfolioProjectKeys.list(listParams),
    queryFn: () => portfolioProjectsApi.list(listParams),
    enabled: accessQuery.isSuccess,
  });

  const detailQuery = useQuery({
    queryKey: portfolioProjectKeys.detail(selectedId ?? 0),
    queryFn: () => portfolioProjectsApi.get(selectedId!),
    enabled: selectedId != null,
  });

  const project = detailQuery.data?.project;
  const roleName = user?.role ?? "";
  const isPlatformAdmin = roleName === "SUPER_ADMIN" || roleName === "ADMIN";
  const membership = project?.members.find(m => m.user.id === user?.id);
  const canChangeStatus =
    isPlatformAdmin || membership?.role === "LEAD" || membership?.role === "MEMBER";
  const canManageTeam = isPlatformAdmin || membership?.role === "LEAD";
  const canUploadArtifact =
    isPlatformAdmin || membership?.role === "LEAD" || membership?.role === "MEMBER";
  const canPostJournal = canUploadArtifact;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: portfolioProjectKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: portfolioProjectsApi.create,
    onSuccess: data => {
      toast.success("Project created");
      setCreateOpen(false);
      invalidate();
      setSelected(data.project.id);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    },
  });

  const patchStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: PortfolioStatus; note?: string }) =>
      portfolioProjectsApi.patchStatus(id, { status, note }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: () => toast.error("Could not update status"),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ id, userId, role }: { id: number; userId: number; role: PortfolioMemberRole }) =>
      portfolioProjectsApi.addMember(id, { userId, role }),
    onSuccess: () => {
      toast.success("Member updated");
      invalidate();
    },
    onError: () => toast.error("Could not update member"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => portfolioProjectsApi.removeMember(id, userId),
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove member"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => portfolioProjectsApi.uploadArtifact(id, file),
    onSuccess: () => {
      toast.success("File uploaded");
      invalidate();
    },
    onError: () => toast.error("Upload failed"),
  });

  const journalWorkLogMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      portfolioProjectsApi.postJournalEntry(id, { entryType: "WORK_LOG", body }),
    onSuccess: () => {
      toast.success("Work log added");
      invalidate();
    },
    onError: () => toast.error("Could not add work log"),
  });

  const journalUpdateMutation = useMutation({
    mutationFn: async ({ id, body, file }: { id: number; body: string; file: File | null }) => {
      const r = await portfolioProjectsApi.postJournalEntry(id, { entryType: "UPDATE", body });
      const newest = r.project.journalEntries.reduce((a, b) => (a.id > b.id ? a : b));
      if (file) {
        await portfolioProjectsApi.uploadJournalArtifact(id, newest.id, file);
      }
      return r;
    },
    onSuccess: () => {
      toast.success("Update posted");
      invalidate();
    },
    onError: () => toast.error("Could not post update"),
  });

  /** Prefer API; while loading or if access fails, allow CTAs when user belongs to an org (matches universal /projects access). */
  const canCreate = accessQuery.data?.canCreate ?? Boolean(user?.organizationId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Portfolio projects</h1>
            <p className="text-sm text-[var(--text-muted)]">Internal and client POC delivery — Cloud &amp; Software</p>
          </div>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateIntent("new");
                setCreateOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              Add new project
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateIntent("existing");
                setCreateOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] shadow-sm transition hover:bg-[var(--bg)]"
            >
              Add existing project
            </button>
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
          Search
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or client"
              className="w-56 rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2 pl-8 pr-3 text-sm text-[var(--text)]"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
          Kind
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value as PortfolioKind | "ALL")}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="ALL">All</option>
            {KINDS.map(k => (
              <option key={k} value={k}>
                {kindFilterLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
          Status
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PortfolioStatus | "ALL")}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="ALL">All</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)]">
          Discipline
          <select
            value={disciplineFilter}
            onChange={e => setDisciplineFilter(e.target.value as PortfolioDiscipline | "ALL")}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="ALL">All</option>
            {DISCIPLINES.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-600">Could not load projects.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(listQuery.data ?? []).map((p: PortfolioProjectListItem) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedId === p.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)]/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--text)]">{p.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{kindLabel(p.kind, p.clientName)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {statusLabel(p.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.disciplines.map(d => (
                    <span
                      key={d}
                      className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(listQuery.data?.length ?? 0) === 0 && !listQuery.isLoading ? (
        <p className="text-center text-sm text-[var(--text-muted)]">No projects match your filters.</p>
      ) : null}

      {createOpen ? (
        <CreateProjectModal
          key={createIntent}
          intent={createIntent}
          currentUserId={user?.id ?? null}
          onClose={() => setCreateOpen(false)}
          onSubmit={body => createMutation.mutate(body)}
          loading={createMutation.isPending}
        />
      ) : null}

      {selectedId != null ? (
        detailQuery.isLoading || !project ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
            <p className="rounded-xl bg-[var(--bg-surface)] px-6 py-4 text-sm shadow-lg">Loading project…</p>
          </div>
        ) : (
          <DetailDrawer
            project={project}
            tab={tab}
            onTab={setTab}
            onClose={() => {
              setSelected(null);
              setTab("overview");
            }}
            canChangeStatus={canChangeStatus}
            canManageTeam={canManageTeam}
            canUploadArtifact={canUploadArtifact}
            onStatusChange={(status, note) => {
              if (selectedId) {
                patchStatusMutation.mutate({ id: selectedId, status, note });
              }
            }}
            onAddMember={(uid, r) => {
              if (selectedId) {
                addMemberMutation.mutate({ id: selectedId, userId: uid, role: r });
              }
            }}
            onRemoveMember={uid => {
              if (selectedId) {
                removeMemberMutation.mutate({ id: selectedId, userId: uid });
              }
            }}
            onUpload={file => {
              if (selectedId) {
                uploadMutation.mutate({ id: selectedId, file });
              }
            }}
            canPostJournal={canPostJournal}
            onPostWorkLog={body => {
              if (selectedId) {
                journalWorkLogMutation.mutate({ id: selectedId, body });
              }
            }}
            onPostUpdate={(body, file) => {
              if (selectedId) {
                journalUpdateMutation.mutate({ id: selectedId, body, file });
              }
            }}
            journalBusy={journalWorkLogMutation.isPending || journalUpdateMutation.isPending}
            statusBusy={patchStatusMutation.isPending}
          />
        )
      ) : null}
    </div>
  );
}

function CreateProjectModal({
  intent,
  currentUserId,
  onClose,
  onSubmit,
  loading,
}: {
  intent: "new" | "existing";
  currentUserId: number | null;
  onClose: () => void;
  onSubmit: (body: Parameters<typeof portfolioProjectsApi.create>[0]) => void;
  loading: boolean;
}) {
  const [kind, setKind] = useState<PortfolioKind>("INTERNAL");
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [tentativeCompletionDate, setTentativeCompletionDate] = useState("");
  const [leadUserId, setLeadUserId] = useState<string>("");
  const [sponsorUserId, setSponsorUserId] = useState<string>("");
  const [alignedIds, setAlignedIds] = useState<number[]>([]);
  const [disciplines, setDisciplines] = useState<PortfolioDiscipline[]>(["CLOUD"]);

  const usersQuery = useQuery({
    queryKey: ["portfolioAssignableUsers"],
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
  });
  const users = usersQuery.data ?? [];

  const toggleDiscipline = (d: PortfolioDiscipline) => {
    setDisciplines(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort(),
    );
  };

  const toggleAligned = (uid: number) => {
    setAlignedIds(prev => (prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]));
  };

  const leadNum = leadUserId ? parseInt(leadUserId, 10) : currentUserId ?? NaN;
  const sponsorNum = sponsorUserId ? parseInt(sponsorUserId, 10) : null;

  const alignedSelectable = users.filter(u => u.id !== leadNum && u.id !== sponsorNum);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {intent === "new" ? "New portfolio project" : "Register existing project"}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {intent === "existing"
                ? "Register work that is already underway — same details as a new project."
                : "Create a new initiative for your portfolio."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim() || disciplines.length === 0 || !Number.isFinite(leadNum)) {
              return;
            }
            const initialMembers = alignedIds
              .filter(uid => uid !== leadNum)
              .map(userId => ({ userId, role: "MEMBER" as const }));
            onSubmit({
              kind,
              name: name.trim(),
              projectType: projectType.trim() || null,
              scopeOfWork: scopeOfWork.trim() || null,
              description: description.trim() || null,
              clientName: needsClientNameKind(kind) ? clientName.trim() || null : null,
              disciplines,
              sponsorUserId: sponsorNum && Number.isFinite(sponsorNum) ? sponsorNum : null,
              tentativeCompletionDate: tentativeCompletionDate.trim() || null,
              leadUserId: leadNum,
              initialMembers: initialMembers.length ? initialMembers : undefined,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Nature</span>
            <select
              value={kind}
              onChange={e => setKind(e.target.value as PortfolioKind)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            >
              <option value="INTERNAL">Internal</option>
              <option value="CLIENT_POC">Client POC</option>
              <option value="CLIENT_PROJECT">Client project</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Name</span>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Project type</span>
            <input
              value={projectType}
              onChange={e => setProjectType(e.target.value)}
              placeholder="e.g. Implementation, Migration"
              list="portfolio-project-type-suggestions"
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
            <datalist id="portfolio-project-type-suggestions">
              <option value="Implementation" />
              <option value="Migration" />
              <option value="Assessment" />
              <option value="Support" />
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Scope of work</span>
            <textarea
              value={scopeOfWork}
              onChange={e => setScopeOfWork(e.target.value)}
              rows={2}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </label>
          {needsClientNameKind(kind) ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Client name</span>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Project under (sponsor)</span>
            <select
              value={sponsorUserId}
              onChange={e => setSponsorUserId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            >
              <option value="">None</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Tentative completion</span>
            <input
              type="date"
              value={tentativeCompletionDate}
              onChange={e => setTentativeCompletionDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Lead</span>
            <select
              value={leadUserId || (currentUserId != null ? String(currentUserId) : "")}
              onChange={e => setLeadUserId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
              required
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-sm text-[var(--text-muted)]">Aligned team members</p>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {alignedSelectable.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Load users…</p>
              ) : (
                alignedSelectable.map(u => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={alignedIds.includes(u.id)} onChange={() => toggleAligned(u.id)} />
                    <span>
                      {u.name} <span className="text-[var(--text-muted)]">({u.email})</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-muted)]">Description</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </label>
          <div>
            <p className="text-sm text-[var(--text-muted)]">Disciplines</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCIPLINES.map(d => (
                <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={disciplines.includes(d)}
                    onChange={() => toggleDiscipline(d)}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-[var(--text-muted)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || disciplines.length === 0 || !Number.isFinite(leadNum)}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailDrawer({
  project,
  tab,
  onTab,
  onClose,
  canChangeStatus,
  canManageTeam,
  canUploadArtifact,
  canPostJournal,
  onStatusChange,
  onAddMember,
  onRemoveMember,
  onUpload,
  onPostWorkLog,
  onPostUpdate,
  journalBusy,
  statusBusy,
}: {
  project: PortfolioProjectDetail;
  tab: "overview" | "team" | "artifacts" | "updates" | "activity";
  onTab: (t: "overview" | "team" | "artifacts" | "updates" | "activity") => void;
  onClose: () => void;
  canChangeStatus: boolean;
  canManageTeam: boolean;
  canUploadArtifact: boolean;
  canPostJournal: boolean;
  onStatusChange: (status: PortfolioStatus, note?: string) => void;
  onAddMember: (userId: number, role: PortfolioMemberRole) => void;
  onRemoveMember: (userId: number) => void;
  onUpload: (file: File) => void;
  onPostWorkLog: (body: string) => void;
  onPostUpdate: (body: string, file: File | null) => void;
  journalBusy: boolean;
  statusBusy: boolean;
}) {

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "team" as const, label: "Team", icon: Users },
    { id: "artifacts" as const, label: "Artifacts", icon: FileText },
    { id: "updates" as const, label: "Updates & work", icon: MessageSquare },
    { id: "activity" as const, label: "Activity", icon: History },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{project.name}</h2>
            <p className="text-xs text-[var(--text-muted)]">{kindLabel(project.kind, project.clientName)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border)] px-2">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                tab === t.id ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "overview" ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Status</p>
                <select
                  disabled={statusBusy || !canChangeStatus}
                  value={project.status}
                  onChange={e => onStatusChange(e.target.value as PortfolioStatus)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Leads and members can update status.</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Disciplines</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {project.disciplines.map(d => (
                    <span key={d} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              {project.projectType ? (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Project type</p>
                  <p className="mt-1 text-sm text-[var(--text)]">{project.projectType}</p>
                </div>
              ) : null}
              {project.scopeOfWork ? (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Scope of work</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{project.scopeOfWork}</p>
                </div>
              ) : null}
              {project.sponsor ? (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Sponsor</p>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {project.sponsor.name} ({project.sponsor.email})
                  </p>
                </div>
              ) : null}
              {project.tentativeCompletionDate ? (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Tentative completion</p>
                  <p className="mt-1 text-sm text-[var(--text)]">{project.tentativeCompletionDate}</p>
                </div>
              ) : null}
              {project.description ? (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{project.description}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "team" ? (
            <TeamTab
              projectId={project.id}
              members={project.members}
              onAdd={onAddMember}
              onRemove={onRemoveMember}
              canManage={canManageTeam}
            />
          ) : null}

          {tab === "artifacts" ? (
            <ArtifactsTab
              projectId={project.id}
              artifacts={project.artifacts}
              onUpload={onUpload}
              canUpload={canUploadArtifact}
            />
          ) : null}

          {tab === "updates" ? (
            <UpdatesWorkTab
              project={project}
              canPost={canPostJournal}
              busy={journalBusy}
              onPostWorkLog={onPostWorkLog}
              onPostUpdate={onPostUpdate}
            />
          ) : null}

          {tab === "activity" ? <ActivityTab activities={project.activities} /> : null}
        </div>
      </div>
    </div>
  );
}

function UpdatesWorkTab({
  project,
  canPost,
  busy,
  onPostWorkLog,
  onPostUpdate,
}: {
  project: PortfolioProjectDetail;
  canPost: boolean;
  busy: boolean;
  onPostWorkLog: (body: string) => void;
  onPostUpdate: (body: string, file: File | null) => void;
}) {
  const [updateBody, setUpdateBody] = useState("");
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [workBody, setWorkBody] = useState("");

  const chronological = useMemo(
    () =>
      [...project.journalEntries].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [project.journalEntries],
  );

  return (
    <div className="flex flex-col gap-6">
      {chronological.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No updates or work logs yet.</p>
      ) : (
        <ul className="space-y-4">
          {chronological.map(j => (
            <li key={j.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                <span>{j.entryType === "UPDATE" ? "Update" : "Work log"}</span>
                <span aria-hidden>·</span>
                <span>{j.user.name}</span>
                <span aria-hidden>·</span>
                <span>{formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[var(--text)]">{j.body}</p>
              {j.artifacts.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                  {j.artifacts.map(a => (
                    <li key={a.id}>
                      <a
                        href={portfolioArtifactFileUrl(project.id, a.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent)] hover:underline"
                      >
                        {a.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canPost ? (
        <div className="space-y-6 border-t border-[var(--border)] pt-4">
          <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">Post update</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Narrative update; you can attach one supporting file.</p>
            <textarea
              value={updateBody}
              onChange={e => setUpdateBody(e.target.value)}
              rows={3}
              placeholder="What changed?"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <label className="mt-2 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              Attachment (optional)
              <input
                type="file"
                className="text-sm"
                onChange={e => {
                  setUpdateFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !updateBody.trim()}
              onClick={() => {
                onPostUpdate(updateBody.trim(), updateFile);
                setUpdateBody("");
                setUpdateFile(null);
              }}
              className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Post update
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">Work log</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Short line: who did what.</p>
            <textarea
              value={workBody}
              onChange={e => setWorkBody(e.target.value)}
              rows={2}
              placeholder="e.g. Finished API integration review"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <button
              type="button"
              disabled={busy || !workBody.trim()}
              onClick={() => {
                onPostWorkLog(workBody.trim());
                setWorkBody("");
              }}
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-50"
            >
              Add work log
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Viewers cannot post updates or work logs.</p>
      )}
    </div>
  );
}

function TeamTab({
  projectId,
  members,
  onAdd,
  onRemove,
  canManage,
}: {
  projectId: number;
  members: PortfolioProjectDetail["members"];
  onAdd: (userId: number, role: PortfolioMemberRole) => void;
  onRemove: (userId: number) => void;
  canManage: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PortfolioMemberRole>("MEMBER");
  const usersQuery = useQuery({
    queryKey: ["hierarchyAssignableUsers", projectId],
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
  });

  const options = (usersQuery.data ?? []).filter(u => !members.some(m => m.user.id === u.id));

  return (
    <div className="flex flex-col gap-4">
      <ul className="space-y-2">
        {members.map(m => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-[var(--text)]">{m.user.name}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {m.role} · {m.user.email}
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => onRemove(m.user.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">Add teammate</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
            >
              <option value="">Select user…</option>
              {options.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={e => setRole(e.target.value as PortfolioMemberRole)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
              <option value="LEAD">Lead</option>
            </select>
            <button
              type="button"
              disabled={!userId}
              onClick={() => {
                const id = parseInt(userId, 10);
                if (Number.isFinite(id)) {
                  onAdd(id, role);
                  setUserId("");
                }
              }}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Only the project lead (or admin) can manage the team.</p>
      )}
    </div>
  );
}

function ArtifactsTab({
  projectId,
  artifacts,
  onUpload,
  canUpload,
}: {
  projectId: number;
  artifacts: PortfolioProjectDetail["artifacts"];
  onUpload: (file: File) => void;
  canUpload: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <label className="flex cursor-pointer flex-col gap-1 text-sm">
          <span className="text-[var(--text-muted)]">Upload file</span>
          <input
            type="file"
            className="text-sm"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                onUpload(f);
                e.target.value = "";
              }
            }}
          />
        </label>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Viewers cannot upload artifacts.</p>
      )}
      <ul className="space-y-2">
        {artifacts.map(a => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
              <span className="truncate">{a.fileName}</span>
              {a.journalEntryId != null ? (
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  Journal
                </span>
              ) : null}
            </span>
            <a
              href={portfolioArtifactFileUrl(projectId, a.id)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[var(--accent)] hover:underline"
            >
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityTab({ activities }: { activities: PortfolioProjectDetail["activities"] }) {
  return (
    <ul className="space-y-3">
      {activities.map(a => (
        <li key={a.id} className="text-sm">
          <p className="font-medium text-[var(--text)]">{a.action.replace(/_/g, " ")}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {a.user.name} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
          </p>
          {a.meta && typeof a.meta === "object" && a.meta !== null && "from" in a.meta ? (
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {String((a.meta as { from?: string }).from)} → {String((a.meta as { to?: string }).to)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
