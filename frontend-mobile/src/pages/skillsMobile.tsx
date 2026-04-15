import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import {
  certificationFileAbsoluteUrl,
  skillsApi,
  type UserCertificationRow,
  type UserSkillRow,
} from "../lib/skillsApi";
import { skillsKeys } from "../lib/queryKeys";

function fmtDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  try {
    return format(new Date(iso + "T12:00:00"), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function MobileSkillsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: skillsKeys.mine(),
    queryFn: () => skillsApi.loadAll(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: skillsKeys.all });
  };

  const [skillModal, setSkillModal] = useState<{ mode: "create" } | { mode: "edit"; row: UserSkillRow } | null>(null);
  const [certModal, setCertModal] = useState<
    { mode: "create" } | { mode: "edit"; row: UserCertificationRow } | null
  >(null);

  const createSkillMut = useMutation({
    mutationFn: skillsApi.createSkill,
    onSuccess: () => {
      invalidate();
      setSkillModal(null);
    },
  });

  const patchSkillMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof skillsApi.patchSkill>[1] }) =>
      skillsApi.patchSkill(id, body),
    onSuccess: () => {
      invalidate();
      setSkillModal(null);
    },
  });

  const deleteSkillMut = useMutation({
    mutationFn: skillsApi.deleteSkill,
    onSuccess: invalidate,
  });

  const createCertMut = useMutation({
    mutationFn: ({
      body,
      certificateFile,
    }: {
      body: Parameters<typeof skillsApi.createCertification>[0];
      certificateFile?: File | null;
    }) => skillsApi.createCertification(body, certificateFile ?? undefined),
    onSuccess: () => {
      invalidate();
      setCertModal(null);
    },
  });

  const patchCertMut = useMutation({
    mutationFn: ({
      id,
      body,
      opts,
    }: {
      id: number;
      body: Parameters<typeof skillsApi.patchCertification>[1];
      opts?: Parameters<typeof skillsApi.patchCertification>[2];
    }) => skillsApi.patchCertification(id, body, opts),
    onSuccess: () => {
      invalidate();
      setCertModal(null);
    },
  });

  const deleteCertMut = useMutation({
    mutationFn: skillsApi.deleteCertification,
    onSuccess: invalidate,
  });

  const skills = query.data?.skills ?? [];
  const certifications = query.data?.certifications ?? [];

  return (
    <div className="min-w-0 space-y-4">
      {query.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Could not load. Try again.</p>
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Skills</h2>
              <button
                type="button"
                onClick={() => setSkillModal({ mode: "create" })}
                className="mobile-tap inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {skills.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No skills yet.</p>
            ) : (
              <ul className="space-y-3">
                {skills.map(s => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">{s.name}</p>
                      {s.proficiency ? (
                        <p className="text-[11px] text-[var(--text-muted)]">{s.proficiency}</p>
                      ) : null}
                      {s.notes ? <p className="mt-1 text-xs text-[var(--text-muted)]">{s.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className="mobile-tap rounded-lg p-2 text-[var(--text-muted)]"
                        onClick={() => setSkillModal({ mode: "edit", row: s })}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="mobile-tap rounded-lg p-2 text-red-600/80"
                        onClick={() => {
                          if (window.confirm(`Remove “${s.name}”?`)) {
                            deleteSkillMut.mutate(s.id);
                          }
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Certifications</h2>
              </div>
              <button
                type="button"
                onClick={() => setCertModal({ mode: "create" })}
                className="mobile-tap inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {certifications.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No certifications yet.</p>
            ) : (
              <ul className="space-y-3">
                {certifications.map(c => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">{c.name}</p>
                      {c.issuer ? (
                        <p className="text-[11px] text-[var(--text-muted)]">{c.issuer}</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                        {c.credentialId ? `ID ${c.credentialId} · ` : ""}
                        Issued {fmtDate(c.issuedOn)} · Expires {fmtDate(c.expiresOn)}
                      </p>
                      {c.notes ? <p className="mt-1 text-xs text-[var(--text-muted)]">{c.notes}</p> : null}
                      {c.certificateDownloadUrl && certificationFileAbsoluteUrl(c) ? (
                        <a
                          href={certificationFileAbsoluteUrl(c)!}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[11px] font-medium text-[var(--accent-primary)] underline"
                        >
                          View certificate
                        </a>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className="mobile-tap rounded-lg p-2 text-[var(--text-muted)]"
                        onClick={() => setCertModal({ mode: "edit", row: c })}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="mobile-tap rounded-lg p-2 text-red-600/80"
                        onClick={() => {
                          if (window.confirm(`Remove “${c.name}”?`)) {
                            deleteCertMut.mutate(c.id);
                          }
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {skillModal ? (
          <MobileSkillSheet
            key={skillModal.mode === "edit" ? `skill-${skillModal.row.id}` : "skill-new"}
            mode={skillModal.mode}
            initial={skillModal.mode === "edit" ? skillModal.row : undefined}
            busy={createSkillMut.isPending || patchSkillMut.isPending}
            onClose={() => setSkillModal(null)}
            onSave={body => {
              if (skillModal.mode === "create") {
                createSkillMut.mutate(body);
              } else {
                patchSkillMut.mutate({ id: skillModal.row.id, body });
              }
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {certModal ? (
          <MobileCertSheet
            key={certModal.mode === "edit" ? `cert-${certModal.row.id}` : "cert-new"}
            mode={certModal.mode}
            initial={certModal.mode === "edit" ? certModal.row : undefined}
            busy={createCertMut.isPending || patchCertMut.isPending}
            onClose={() => setCertModal(null)}
            onSave={payload => {
              if (certModal.mode === "create") {
                createCertMut.mutate({
                  body: payload.body,
                  certificateFile: payload.certificateFile,
                });
              } else {
                patchCertMut.mutate({
                  id: certModal.row.id,
                  body: payload.body,
                  opts:
                    payload.certificateFile || payload.clearCertificate
                      ? {
                          certificateFile: payload.certificateFile,
                          clearCertificate: payload.clearCertificate,
                        }
                      : undefined,
                });
              }
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const sheetInputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

function AnimatedSheet({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-end px-3 pb-[max(0.5rem,var(--safe-bottom))] pt-10 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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
        {children}
      </motion.div>
    </motion.div>
  );
}

function MobileSkillSheet({
  mode,
  initial,
  busy,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: UserSkillRow;
  busy: boolean;
  onClose: () => void;
  onSave: (body: { name: string; proficiency?: string | null; notes?: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [proficiency, setProficiency] = useState(initial?.proficiency ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <AnimatedSheet titleId="skill-sheet-title" onClose={onClose}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) {
            return;
          }
          onSave({
            name: name.trim(),
            proficiency: proficiency.trim() || null,
            notes: notes.trim() || null,
          });
        }}
      >
        <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
          <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <h3 id="skill-sheet-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {mode === "create" ? "Add skill" : "Edit skill"}
            </h3>
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
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="ms-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="ms-name"
                required
                autoComplete="off"
                placeholder="e.g. React, Azure DevOps"
                value={name}
                onChange={e => setName(e.target.value)}
                className={sheetInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="ms-prof">
                Proficiency <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                id="ms-prof"
                placeholder="e.g. Advanced, 4 years"
                value={proficiency}
                onChange={e => setProficiency(e.target.value)}
                className={sheetInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="ms-notes">
                Notes <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <textarea
                id="ms-notes"
                placeholder="Context, projects, tools…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className={`${sheetInputClass} min-h-[4.5rem] resize-y`}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
          <button
            type="submit"
            disabled={busy}
            className="mobile-tap w-full rounded-xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </AnimatedSheet>
  );
}

function MobileCertSheet({
  mode,
  initial,
  busy,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: UserCertificationRow;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    body: {
      name: string;
      issuer?: string | null;
      credentialId?: string | null;
      issuedOn?: string | null;
      expiresOn?: string | null;
      notes?: string | null;
    };
    certificateFile?: File | null;
    clearCertificate?: boolean;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [credentialId, setCredentialId] = useState(initial?.credentialId ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [clearCertificate, setClearCertificate] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setIssuer(initial?.issuer ?? "");
    setCredentialId(initial?.credentialId ?? "");
    setIssuedOn(initial?.issuedOn ?? "");
    setExpiresOn(initial?.expiresOn ?? "");
    setNotes(initial?.notes ?? "");
    setCertificateFile(null);
    setClearCertificate(false);
  }, [initial?.id, mode]);

  return (
    <AnimatedSheet titleId="cert-sheet-title" onClose={onClose}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) {
            return;
          }
          onSave({
            body: {
              name: name.trim(),
              issuer: issuer.trim() || null,
              credentialId: credentialId.trim() || null,
              issuedOn: issuedOn.trim() || null,
              expiresOn: expiresOn.trim() || null,
              notes: notes.trim() || null,
            },
            certificateFile: certificateFile ?? undefined,
            clearCertificate: clearCertificate || undefined,
          });
        }}
      >
        <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
          <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <h3 id="cert-sheet-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {mode === "create" ? "Add certification" : "Edit certification"}
            </h3>
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
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="mc-name"
                required
                placeholder="e.g. AWS Solutions Architect"
                value={name}
                onChange={e => setName(e.target.value)}
                className={sheetInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-issuer">
                Issuer <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                id="mc-issuer"
                placeholder="Organization or vendor"
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                className={sheetInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-cred">
                Credential ID <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                id="mc-cred"
                placeholder="License or certificate number"
                value={credentialId}
                onChange={e => setCredentialId(e.target.value)}
                className={sheetInputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-issued">
                  Issued on
                </label>
                <input
                  id="mc-issued"
                  type="date"
                  value={issuedOn}
                  onChange={e => setIssuedOn(e.target.value)}
                  className={sheetInputClass}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-exp">
                  Expires on
                </label>
                <input
                  id="mc-exp"
                  type="date"
                  value={expiresOn}
                  onChange={e => setExpiresOn(e.target.value)}
                  className={sheetInputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mc-notes">
                Notes <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <textarea
                id="mc-notes"
                placeholder="Extra details"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className={`${sheetInputClass} min-h-[4rem] resize-y`}
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Certificate <span className="font-normal text-[var(--text-muted)]">(optional, PDF or image)</span>
              </span>
              {mode === "edit" && initial?.certificateDownloadUrl && certificationFileAbsoluteUrl(initial) && !clearCertificate ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={certificationFileAbsoluteUrl(initial)!}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--accent-primary)] underline"
                  >
                    Open current file
                  </a>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--text-muted)]"
                    onClick={() => {
                      setClearCertificate(true);
                      setCertificateFile(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setCertificateFile(f);
                  if (f) {
                    setClearCertificate(false);
                  }
                }}
                className="w-full text-xs text-[var(--text-muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-2 file:text-xs file:font-medium"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
          <button
            type="submit"
            disabled={busy}
            className="mobile-tap w-full rounded-xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </AnimatedSheet>
  );
}
