import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { api } from "../lib/api";

type CrmDepartment = { id: number; name: string; employeeCount: number };
type DeptUser = { id: number; name: string; email: string; isActive: boolean; roleName: string };

export function DepartmentManagementContent() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [usersModalDept, setUsersModalDept] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-crm-departments"],
    queryFn: async () => {
      const res = await api.get("/api/hr/crm-departments");
      return res.data?.data?.departments as CrmDepartment[];
    },
  });

  const departments = data ?? [];

  const usersModalQuery = useQuery({
    queryKey: ["hr-crm-department-users", usersModalDept?.id],
    queryFn: async () => {
      const id = usersModalDept?.id;
      if (id == null) return [];
      const res = await api.get(`/api/hr/crm-departments/${id}/users`);
      return res.data?.data?.users as DeptUser[];
    },
    enabled: usersModalDept != null,
  });

  useEffect(() => {
    if (!usersModalDept) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUsersModalDept(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [usersModalDept]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["hr-crm-departments"] });
    await queryClient.invalidateQueries({ queryKey: ["settings-departments"] });
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post("/api/hr/crm-departments", { name });
    },
    onSuccess: async () => {
      setNewName("");
      setFormError(null);
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not create department");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await api.patch(`/api/hr/crm-departments/${id}`, { name });
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditName("");
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/hr/crm-departments/${id}`);
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setFormError(msg ?? "Could not delete");
    },
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const n = newName.trim();
    if (!n) {
      setFormError("Enter a department name.");
      return;
    }
    createMutation.mutate(n);
  };

  const startEdit = (d: CrmDepartment) => {
    setFormError(null);
    setEditingId(d.id);
    setEditName(d.name);
  };

  const saveEdit = () => {
    if (editingId == null) return;
    const n = editName.trim();
    if (!n) {
      setFormError("Name cannot be empty.");
      return;
    }
    setFormError(null);
    updateMutation.mutate({ id: editingId, name: n });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Same CRM departments as in user settings. Renaming updates everyone assigned to the old name.
      </p>

      <form onSubmit={onCreate} className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <label className="text-xs font-medium text-[var(--text-muted)]">New department</label>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Department name"
          className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="mt-2 w-full rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {createMutation.isPending ? "Adding…" : "Add department"}
        </button>
      </form>

      {formError && <p className="text-sm text-[var(--danger)]">{formError}</p>}

      {usersModalDept && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 pb-0 sm:p-4 sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dept-users-title-mobile"
          onClick={() => setUsersModalDept(null)}
        >
          <div
            className="mx-auto w-full min-w-0 max-w-lg max-h-[85vh] overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 id="dept-users-title-mobile" className="text-base font-semibold text-[var(--text-primary)]">
                {usersModalDept.name}
              </h2>
              <button
                type="button"
                onClick={() => setUsersModalDept(null)}
                className="rounded-xl p-2 text-[var(--text-muted)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto px-4 pb-6">
              {usersModalQuery.isLoading ? (
                <p className="py-6 text-sm text-[var(--text-muted)]">Loading users…</p>
              ) : usersModalQuery.isError ? (
                <p className="py-6 text-sm text-[var(--danger)]">Could not load users.</p>
              ) : (usersModalQuery.data?.length ?? 0) === 0 ? (
                <p className="py-6 text-sm text-[var(--text-muted)]">No users in this department.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {usersModalQuery.data!.map(u => (
                    <li key={u.id} className="first:pt-2">
                      <Link
                        to={`/hr/users/${u.id}`}
                        onClick={() => setUsersModalDept(null)}
                        className="-mx-1 block rounded-xl px-1 py-4 active:bg-[var(--bg-elevated)]"
                      >
                        <p className="font-medium text-[var(--text-primary)]">{u.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {u.roleName}
                          {u.isActive ? "" : " · Inactive"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <div className="space-y-2">
          {departments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No departments yet.
            </p>
          ) : (
            departments.map(d => (
              <div
                key={d.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-sm"
              >
                {editingId === d.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditName("");
                        }}
                        className="flex-1 rounded-xl border border-[var(--border)] py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={updateMutation.isPending}
                        className="flex-1 rounded-xl bg-[var(--accent-primary)] py-2 text-sm text-white disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setUsersModalDept({ id: d.id, name: d.name })}
                      className="min-w-0 flex-1 text-left font-medium text-[var(--text-primary)]"
                    >
                      {d.name}{" "}
                      <span className="font-normal text-[var(--text-muted)]">({d.employeeCount})</span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="rounded-lg p-2 text-[var(--accent-primary)]"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${d.name}"? Only if no users are assigned to this department.`,
                            )
                          ) {
                            setFormError(null);
                            deleteMutation.mutate(d.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg p-2 text-red-600 disabled:opacity-60"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
