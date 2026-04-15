import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import {
  portfolioArtifactFileUrl,
  portfolioProjectsApi,
  type PortfolioKind,
  type PortfolioProjectDetail,
  type PortfolioProjectListItem,
  type PortfolioStatus,
} from "../lib/portfolioProjectsApi";
import { portfolioProjectKeys } from "../lib/queryKeys";
import { hierarchyTasksApi } from "../lib/hierarchyTasksApi";

const STATUSES: PortfolioStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "BLOCKED",
  "ON_HOLD",
  "DONE",
  "CANCELLED",
];

function statusLabel(s: PortfolioStatus): string {
  return s.replace(/_/g, " ");
}

function kindLabel(kind: PortfolioKind, clientName: string | null): string {
  if (kind === "INTERNAL") {
    return "Internal";
  }
  if (kind === "CLIENT_POC") {
    return `POC · ${clientName ?? "Client"}`;
  }
  return `Client · ${clientName ?? "Client"}`;
}

function needsClientNameKind(kind: PortfolioKind): boolean {
  return kind === "CLIENT_POC" || kind === "CLIENT_PROJECT";
}

export function MobilePortfolioProjectsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const projectIdParam = params.projectId ? parseInt(params.projectId, 10) : NaN;
  const selectedId = Number.isFinite(projectIdParam) ? projectIdParam : null;
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createIntent, setCreateIntent] = useState<"new" | "existing">("new");

  const listParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) {
      p.search = search.trim();
    }
    return p;
  }, [search]);

  const accessQuery = useQuery({
    queryKey: portfolioProjectKeys.access(),
    queryFn: () => portfolioProjectsApi.getAccess(),
    enabled: Boolean(user?.organizationId),
  });

  const listQuery = useQuery({
    queryKey: portfolioProjectKeys.list(listParams),
    queryFn: () => portfolioProjectsApi.list(listParams),
    enabled: Boolean(user?.organizationId) && accessQuery.isSuccess,
  });

  const detailQuery = useQuery({
    queryKey: portfolioProjectKeys.detail(selectedId ?? 0),
    queryFn: () => portfolioProjectsApi.get(selectedId!),
    enabled: selectedId != null && Boolean(user?.organizationId),
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
      setCreateOpen(false);
      invalidate();
      navigate(`/projects/portfolio/${data.project.id}`);
    },
  });

  const patchStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: number;
      status: PortfolioStatus;
      note?: string;
    }) => portfolioProjectsApi.patchStatus(id, { status, note }),
    onSuccess: () => invalidate(),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({
      id,
      userId,
      role,
    }: {
      id: number;
      userId: number;
      role: "LEAD" | "MEMBER" | "VIEWER";
    }) => portfolioProjectsApi.addMember(id, { userId, role }),
    onSuccess: () => invalidate(),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      portfolioProjectsApi.removeMember(id, userId),
    onSuccess: () => invalidate(),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => portfolioProjectsApi.uploadArtifact(id, file),
    onSuccess: () => invalidate(),
  });

  const journalWorkLogMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      portfolioProjectsApi.postJournalEntry(id, { entryType: "WORK_LOG", body }),
    onSuccess: () => invalidate(),
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
    onSuccess: () => invalidate(),
  });

  if (!user?.organizationId) {
    return (
      <p className="max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
        Your account is not linked to an organization.
      </p>
    );
  }

  if (selectedId != null) {
    if (detailQuery.isLoading || !project) {
      return <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading…</p>;
    }
    return (
      <MobilePortfolioDetail
        project={project}
        onBack={() => navigate("/projects/portfolio")}
        canChangeStatus={canChangeStatus}
        canManageTeam={canManageTeam}
        canUploadArtifact={canUploadArtifact}
        canPostJournal={canPostJournal}
        journalBusy={journalWorkLogMutation.isPending || journalUpdateMutation.isPending}
        onStatusChange={status => patchStatusMutation.mutate({ id: project.id, status })}
        onAddMember={(userId, role) => addMemberMutation.mutate({ id: project.id, userId, role })}
        onRemoveMember={userId => removeMemberMutation.mutate({ id: project.id, userId })}
        onUpload={file => uploadMutation.mutate({ id: project.id, file })}
        onPostWorkLog={body => journalWorkLogMutation.mutate({ id: project.id, body })}
        onPostUpdate={(body, file) => journalUpdateMutation.mutate({ id: project.id, body, file })}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="relative min-w-0 flex-1 basis-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className="mobile-tap w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] py-3 pl-9 pr-3 text-sm"
          />
        </span>
        {accessQuery.data?.canCreate ?? Boolean(user?.organizationId) ? (
          <>
            <button
              type="button"
              onClick={() => {
                setCreateIntent("new");
                setCreateOpen(true);
              }}
              className="mobile-tap inline-flex shrink-0 items-center gap-1 rounded-2xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateIntent("existing");
                setCreateOpen(true);
              }}
              className="mobile-tap inline-flex shrink-0 items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
            >
              Existing
            </button>
          </>
        ) : null}
      </div>
      {listQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (listQuery.data ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">No projects match.</p>
      ) : (
        <div className="space-y-2">
          {(listQuery.data ?? []).map((p: PortfolioProjectListItem) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/projects/portfolio/${p.id}`)}
              className="mobile-tap w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-left"
            >
              <p className="break-words font-semibold text-[var(--text-primary)]">{p.name}</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{kindLabel(p.kind, p.clientName)}</p>
              <p className="mt-1 text-[10px] uppercase text-[var(--text-muted)]">{statusLabel(p.status)}</p>
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>
        {createOpen ? (
          <CreateSheet
            key={createIntent}
            intent={createIntent}
            currentUserId={user?.id ?? null}
            onClose={() => setCreateOpen(false)}
            onSubmit={body => createMutation.mutate(body)}
            loading={createMutation.isPending}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CreateSheet({
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
  const [leadUserId, setLeadUserId] = useState("");
  const [sponsorUserId, setSponsorUserId] = useState("");
  const [alignedIds, setAlignedIds] = useState<number[]>([]);
  const [disciplines, setDisciplines] = useState<Array<"CLOUD" | "SOFTWARE">>(["CLOUD"]);

  const usersQuery = useQuery({
    queryKey: ["portfolioAssignableUsersMobile"],
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
  });
  const users = usersQuery.data ?? [];

  const toggle = (d: "CLOUD" | "SOFTWARE") => {
    setDisciplines(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
  };

  const toggleAligned = (uid: number) => {
    setAlignedIds(prev => (prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]));
  };

  const leadNum = leadUserId ? parseInt(leadUserId, 10) : currentUserId ?? NaN;
  const sponsorNum = sponsorUserId ? parseInt(sponsorUserId, 10) : null;
  const alignedSelectable = users.filter(u => u.id !== leadNum && u.id !== sponsorNum);

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col justify-end items-center px-3 pb-[max(0.5rem,var(--safe-bottom))] pt-10 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-create-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative z-[1] flex min-h-0 w-full max-w-lg max-h-[min(88dvh,calc(100dvh-1.25rem))] flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
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
          <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
            <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="portfolio-create-title" className="text-lg font-semibold text-[var(--text-primary)]">
                  {intent === "new" ? "New project" : "Existing project"}
                </h2>
                <p className="mt-1.5 text-sm leading-snug text-[var(--text-muted)]">
                  {intent === "existing" ? "Register work already underway." : "Add a new portfolio entry."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-base)]"
              >
                Close
              </button>
            </div>
          </div>

          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-kind">
                  Nature
                </label>
                <select
                  id="pf-kind"
                  value={kind}
                  onChange={e => setKind(e.target.value as PortfolioKind)}
                  className={inputClass}
                >
                  <option value="INTERNAL">Internal</option>
                  <option value="CLIENT_POC">Client POC</option>
                  <option value="CLIENT_PROJECT">Client project</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-name">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="pf-name"
                  required
                  autoComplete="off"
                  placeholder="Project name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-type">
                  Project type
                </label>
                <input
                  id="pf-type"
                  autoComplete="off"
                  placeholder="e.g. Implementation, Migration"
                  value={projectType}
                  onChange={e => setProjectType(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-scope">
                  Scope of work
                </label>
                <textarea
                  id="pf-scope"
                  placeholder="What is included?"
                  value={scopeOfWork}
                  onChange={e => setScopeOfWork(e.target.value)}
                  rows={3}
                  className={`${inputClass} min-h-[4.5rem] resize-y`}
                />
              </div>

              {needsClientNameKind(kind) ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-client">
                    Client name
                  </label>
                  <input
                    id="pf-client"
                    autoComplete="organization"
                    placeholder="Client organization"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-sponsor">
                  Sponsor
                </label>
                <select
                  id="pf-sponsor"
                  value={sponsorUserId}
                  onChange={e => setSponsorUserId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  className="text-xs font-medium tracking-wide text-[var(--text-muted)]"
                  htmlFor="pf-complete"
                >
                  Tentative completion
                </label>
                <input
                  id="pf-complete"
                  type="date"
                  value={tentativeCompletionDate}
                  onChange={e => setTentativeCompletionDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-lead">
                  Lead <span className="text-red-500">*</span>
                </label>
                <select
                  id="pf-lead"
                  value={leadUserId || (currentUserId != null ? String(currentUserId) : "")}
                  onChange={e => setLeadUserId(e.target.value)}
                  className={inputClass}
                  required
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">Aligned members</p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3">
                  {alignedSelectable.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No other users to add.</p>
                  ) : (
                    alignedSelectable.map(u => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-3 py-1 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-[var(--border)]"
                          checked={alignedIds.includes(u.id)}
                          onChange={() => toggleAligned(u.id)}
                        />
                        <span className="text-[var(--text-primary)]">{u.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[var(--text-muted)]" htmlFor="pf-desc">
                  Description <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  id="pf-desc"
                  placeholder="Extra context"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className={`${inputClass} min-h-[4.5rem] resize-y`}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">Disciplines</p>
                <div className="flex flex-wrap gap-4 pt-0.5 text-sm">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)]"
                      checked={disciplines.includes("CLOUD")}
                      onChange={() => toggle("CLOUD")}
                    />
                    <span>CLOUD</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)]"
                      checked={disciplines.includes("SOFTWARE")}
                      onChange={() => toggle("SOFTWARE")}
                    />
                    <span>SOFTWARE</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
            <button
              type="submit"
              disabled={loading || !Number.isFinite(leadNum)}
              className="mobile-tap mobile-tap-strong w-full rounded-xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create project"}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
              Fields marked * are required
            </p>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function MobileUpdatesTab({
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
    <div className="space-y-4">
      {chronological.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No updates yet.</p>
      ) : (
        <ul className="space-y-3">
          {chronological.map(j => (
            <li key={j.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
              <p className="text-[10px] font-medium uppercase text-[var(--text-muted)]">
                {j.entryType === "UPDATE" ? "Update" : "Work log"} · {j.user.name} ·{" "}
                {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{j.body}</p>
              {j.artifacts.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {j.artifacts.map(a => (
                    <li key={a.id}>
                      <a
                        href={portfolioArtifactFileUrl(project.id, a.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-primary)]"
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
        <div className="space-y-4 border-t border-[var(--border)] pt-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Update</p>
            <textarea
              value={updateBody}
              onChange={e => setUpdateBody(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
            />
            <input
              type="file"
              className="mt-1 text-xs"
              onChange={e => setUpdateFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy || !updateBody.trim()}
              onClick={() => {
                onPostUpdate(updateBody.trim(), updateFile);
                setUpdateBody("");
                setUpdateFile(null);
              }}
              className="mt-2 w-full rounded-xl bg-[var(--accent-primary)] py-2 text-sm text-white disabled:opacity-50"
            >
              Post
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Work log</p>
            <textarea
              value={workBody}
              onChange={e => setWorkBody(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !workBody.trim()}
              onClick={() => {
                onPostWorkLog(workBody.trim());
                setWorkBody("");
              }}
              className="mt-2 w-full rounded-xl border border-[var(--border)] py-2 text-sm disabled:opacity-50"
            >
              Add log
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Viewers cannot post.</p>
      )}
    </div>
  );
}

function MobilePortfolioDetail({
  project,
  onBack,
  canChangeStatus,
  canManageTeam,
  canUploadArtifact,
  canPostJournal,
  journalBusy,
  onStatusChange,
  onAddMember,
  onRemoveMember,
  onUpload,
  onPostWorkLog,
  onPostUpdate,
}: {
  project: PortfolioProjectDetail;
  onBack: () => void;
  canChangeStatus: boolean;
  canManageTeam: boolean;
  canUploadArtifact: boolean;
  canPostJournal: boolean;
  journalBusy: boolean;
  onStatusChange: (s: PortfolioStatus) => void;
  onAddMember: (userId: number, role: "LEAD" | "MEMBER" | "VIEWER") => void;
  onRemoveMember: (userId: number) => void;
  onUpload: (file: File) => void;
  onPostWorkLog: (body: string) => void;
  onPostUpdate: (body: string, file: File | null) => void;
}) {
  const [tab, setTab] = useState<"info" | "team" | "files" | "updates">("info");
  const usersQuery = useQuery({
    queryKey: ["assignableUsersPortfolio"],
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
  });
  const [pickUser, setPickUser] = useState("");
  const [pickRole, setPickRole] = useState<"MEMBER" | "VIEWER" | "LEAD">("MEMBER");
  const options = (usersQuery.data ?? []).filter(u => !project.members.some(m => m.user.id === u.id));

  return (
    <div className="min-w-0 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="mobile-tap inline-flex max-w-full items-center gap-2 text-sm text-[var(--accent-primary)]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Back to portfolio
      </button>
      <h2 className="break-words text-lg font-semibold leading-tight text-[var(--text-primary)]">{project.name}</h2>
      <p className="text-[11px] text-[var(--text-muted)]">{kindLabel(project.kind, project.clientName)}</p>
      <div className="flex border-b border-[var(--border)] text-[11px] font-medium">
        {(
          [
            ["info", "Info"],
            ["team", "Team"],
            ["files", "Files"],
            ["updates", "Work"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-3 ${tab === id ? "border-b-2 border-[var(--accent-primary)] text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {tab === "info" ? (
          <>
            <label className="block text-xs text-[var(--text-muted)]">
              Status
              <select
                disabled={!canChangeStatus}
                value={project.status}
                onChange={e => onStatusChange(e.target.value as PortfolioStatus)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {project.projectType ? (
              <p className="text-sm">
                <span className="text-[var(--text-muted)]">Type: </span>
                {project.projectType}
              </p>
            ) : null}
            {project.scopeOfWork ? (
              <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{project.scopeOfWork}</p>
            ) : null}
            {project.sponsor ? (
              <p className="text-xs text-[var(--text-muted)]">
                Sponsor: {project.sponsor.name} ({project.sponsor.email})
              </p>
            ) : null}
            {project.tentativeCompletionDate ? (
              <p className="text-xs text-[var(--text-muted)]">Completion: {project.tentativeCompletionDate}</p>
            ) : null}
            {project.description ? (
              <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{project.description}</p>
            ) : null}
            <div className="text-xs text-[var(--text-muted)]">
              <p className="font-medium">Activity</p>
              <ul className="mt-2 space-y-2">
                {project.activities.slice(0, 12).map(a => (
                  <li key={a.id}>
                    {a.action} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
        {tab === "team" ? (
          <div className="space-y-3">
            {project.members.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{m.role}</p>
                </div>
                {canManageTeam ? (
                  <button type="button" className="text-xs text-red-600" onClick={() => onRemoveMember(m.user.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {canManageTeam ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3">
                <select
                  value={pickUser}
                  onChange={e => setPickUser(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
                >
                  <option value="">Add user…</option>
                  {options.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <select
                  value={pickRole}
                  onChange={e => setPickRole(e.target.value as "LEAD" | "MEMBER" | "VIEWER")}
                  className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="LEAD">Lead</option>
                </select>
                <button
                  type="button"
                  disabled={!pickUser}
                  onClick={() => {
                    const id = parseInt(pickUser, 10);
                    if (Number.isFinite(id)) {
                      onAddMember(id, pickRole);
                      setPickUser("");
                    }
                  }}
                  className="w-full rounded-lg bg-[var(--accent-primary)] py-2 text-sm text-white"
                >
                  Add
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {tab === "files" ? (
          <div className="space-y-3">
            {canUploadArtifact ? (
              <input
                type="file"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    onUpload(f);
                    e.target.value = "";
                  }
                }}
              />
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Viewers cannot upload.</p>
            )}
            {project.artifacts.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                {a.journalEntryId != null ? (
                  <span className="shrink-0 rounded bg-neutral-200 px-1 py-0.5 text-[9px] uppercase dark:bg-neutral-700">
                    J
                  </span>
                ) : null}
                <a
                  href={portfolioArtifactFileUrl(project.id, a.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-[var(--accent-primary)]"
                >
                  {a.fileName}
                </a>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "updates" ? (
          <MobileUpdatesTab
            project={project}
            canPost={canPostJournal}
            busy={journalBusy}
            onPostWorkLog={onPostWorkLog}
            onPostUpdate={onPostUpdate}
          />
        ) : null}
      </div>
    </div>
  );
}
