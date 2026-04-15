import { api } from "./api";

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

export type PortfolioKind = "INTERNAL" | "CLIENT_POC" | "CLIENT_PROJECT";
export type PortfolioStatus = "PLANNED" | "IN_PROGRESS" | "BLOCKED" | "ON_HOLD" | "DONE" | "CANCELLED";
export type PortfolioDiscipline = "CLOUD" | "SOFTWARE";
export type PortfolioMemberRole = "LEAD" | "MEMBER" | "VIEWER";
export type PortfolioJournalEntryType = "UPDATE" | "WORK_LOG";

export interface PortfolioSponsorRef {
  id: number;
  name: string;
  email: string;
}

export interface PortfolioProjectListItem {
  id: number;
  organizationId: number;
  kind: PortfolioKind;
  name: string;
  projectType: string | null;
  scopeOfWork: string | null;
  description: string | null;
  clientName: string | null;
  sponsorUserId: number | null;
  sponsor: PortfolioSponsorRef | null;
  tentativeCompletionDate: string | null;
  status: PortfolioStatus;
  disciplines: PortfolioDiscipline[];
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; email: string };
}

export interface PortfolioMemberRow {
  id: number;
  role: PortfolioMemberRole;
  user: {
    id: number;
    name: string;
    email: string;
    department?: string | null;
    role: { name: string };
  };
}

export interface PortfolioArtifactRow {
  id: number;
  journalEntryId: number | null;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  uploadedBy: { id: number; name: string };
  downloadPath: string;
}

export interface PortfolioJournalEntryRow {
  id: number;
  entryType: PortfolioJournalEntryType;
  body: string;
  createdAt: string;
  user: { id: number; name: string };
  artifacts: PortfolioArtifactRow[];
}

export interface PortfolioActivityRow {
  id: number;
  action: string;
  meta: unknown;
  createdAt: string;
  user: { id: number; name: string };
}

export interface PortfolioProjectDetail {
  id: number;
  organizationId: number;
  kind: PortfolioKind;
  name: string;
  projectType: string | null;
  scopeOfWork: string | null;
  description: string | null;
  clientName: string | null;
  sponsorUserId: number | null;
  sponsor: PortfolioSponsorRef | null;
  tentativeCompletionDate: string | null;
  status: PortfolioStatus;
  disciplines: PortfolioDiscipline[];
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; email: string };
  members: PortfolioMemberRow[];
  artifacts: PortfolioArtifactRow[];
  journalEntries: PortfolioJournalEntryRow[];
  activities: PortfolioActivityRow[];
}

export interface PortfolioAccessMeta {
  canCreate: boolean;
  organizationId: number;
}

export interface ListPortfolioParams {
  kind?: PortfolioKind;
  status?: string;
  discipline?: PortfolioDiscipline;
  search?: string;
}

export type CreatePortfolioProjectBody = {
  kind: PortfolioKind;
  name: string;
  projectType?: string | null;
  scopeOfWork?: string | null;
  description?: string | null;
  clientName?: string | null;
  disciplines: PortfolioDiscipline[];
  sponsorUserId?: number | null;
  /** ISO date YYYY-MM-DD */
  tentativeCompletionDate?: string | null;
  leadUserId?: number;
  initialMembers?: Array<{ userId: number; role: "MEMBER" | "VIEWER" }>;
};

export const portfolioProjectsApi = {
  async getAccess(): Promise<PortfolioAccessMeta> {
    const res = await api.get<ApiEnvelope<PortfolioAccessMeta>>("/api/portfolio-projects/access");
    return res.data.data;
  },

  async list(params?: ListPortfolioParams): Promise<PortfolioProjectListItem[]> {
    const res = await api.get<ApiEnvelope<{ projects: PortfolioProjectListItem[] }>>("/api/portfolio-projects", {
      params,
    });
    return res.data.data.projects;
  },

  async get(id: number): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.get<ApiEnvelope<{ project: PortfolioProjectDetail }>>(`/api/portfolio-projects/${id}`);
    return res.data.data;
  },

  async create(body: CreatePortfolioProjectBody): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.post<ApiEnvelope<{ project: PortfolioProjectDetail }>>("/api/portfolio-projects", body);
    return res.data.data;
  },

  async patch(
    id: number,
    body: Partial<{
      name: string;
      projectType: string | null;
      scopeOfWork: string | null;
      description: string | null;
      clientName: string | null;
      disciplines: PortfolioDiscipline[];
      sponsorUserId: number | null;
      tentativeCompletionDate: string | null;
    }>,
  ): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.patch<ApiEnvelope<{ project: PortfolioProjectDetail }>>(
      `/api/portfolio-projects/${id}`,
      body,
    );
    return res.data.data;
  },

  async patchStatus(
    id: number,
    body: { status: PortfolioStatus; note?: string },
  ): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.patch<ApiEnvelope<{ project: PortfolioProjectDetail }>>(
      `/api/portfolio-projects/${id}/status`,
      body,
    );
    return res.data.data;
  },

  async postJournalEntry(
    id: number,
    body: { entryType: PortfolioJournalEntryType; body: string },
  ): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.post<ApiEnvelope<{ project: PortfolioProjectDetail }>>(
      `/api/portfolio-projects/${id}/journal-entries`,
      body,
    );
    return res.data.data;
  },

  async addMember(
    id: number,
    body: { userId: number; role: PortfolioMemberRole },
  ): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.post<ApiEnvelope<{ project: PortfolioProjectDetail }>>(
      `/api/portfolio-projects/${id}/members`,
      body,
    );
    return res.data.data;
  },

  async removeMember(id: number, userId: number): Promise<{ project: PortfolioProjectDetail }> {
    const res = await api.delete<ApiEnvelope<{ project: PortfolioProjectDetail }>>(
      `/api/portfolio-projects/${id}/members/${userId}`,
    );
    return res.data.data;
  },

  async uploadArtifact(
    id: number,
    file: File,
    opts?: { kind?: string; note?: string; journalEntryId?: number },
  ): Promise<{ project: PortfolioProjectDetail; artifactId: number }> {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.kind) {
      fd.append("kind", opts.kind);
    }
    if (opts?.note) {
      fd.append("note", opts.note);
    }
    if (opts?.journalEntryId != null) {
      fd.append("journalEntryId", String(opts.journalEntryId));
    }
    const res = await api.post<ApiEnvelope<{ project: PortfolioProjectDetail; artifactId: number }>>(
      `/api/portfolio-projects/${id}/artifacts`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },

  async uploadJournalArtifact(
    projectId: number,
    journalId: number,
    file: File,
    opts?: { kind?: string; note?: string },
  ): Promise<{ project: PortfolioProjectDetail; artifactId: number }> {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.kind) {
      fd.append("kind", opts.kind);
    }
    if (opts?.note) {
      fd.append("note", opts.note);
    }
    const res = await api.post<ApiEnvelope<{ project: PortfolioProjectDetail; artifactId: number }>>(
      `/api/portfolio-projects/${projectId}/journal-entries/${journalId}/artifacts`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return res.data.data;
  },
};

export function portfolioArtifactFileUrl(projectId: number, artifactId: number): string {
  const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  const base = raw?.replace(/\/+$/, "") ?? "";
  const path = `/api/portfolio-projects/${projectId}/artifacts/${artifactId}/file`;
  return base ? `${base}${path}` : path;
}
