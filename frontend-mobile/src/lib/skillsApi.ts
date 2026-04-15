import { api } from "./api";

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

export interface UserSkillRow {
  id: number;
  name: string;
  proficiency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserCertificationRow {
  id: number;
  name: string;
  issuer: string | null;
  credentialId: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string | null;
  certificateDownloadUrl: string | null;
  certificateOriginalName: string | null;
  certificateMimeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export function certificationFileAbsoluteUrl(cert: UserCertificationRow): string | null {
  if (!cert.certificateDownloadUrl) {
    return null;
  }
  const base = (api.defaults.baseURL ?? "").replace(/\/+$/, "");
  return `${base}${cert.certificateDownloadUrl}`;
}

function appendCertificationFields(
  fd: FormData,
  body: {
    name: string;
    issuer?: string | null;
    credentialId?: string | null;
    issuedOn?: string | null;
    expiresOn?: string | null;
    notes?: string | null;
  },
) {
  fd.append("name", body.name);
  fd.append("issuer", body.issuer ?? "");
  fd.append("credentialId", body.credentialId ?? "");
  fd.append("issuedOn", body.issuedOn ?? "");
  fd.append("expiresOn", body.expiresOn ?? "");
  fd.append("notes", body.notes ?? "");
}

export const skillsApi = {
  async listSkills(): Promise<UserSkillRow[]> {
    const res = await api.get<ApiEnvelope<{ skills: UserSkillRow[] }>>("/api/skills");
    return res.data.data.skills;
  },

  async createSkill(body: {
    name: string;
    proficiency?: string | null;
    notes?: string | null;
  }): Promise<UserSkillRow> {
    const res = await api.post<ApiEnvelope<{ skill: UserSkillRow }>>("/api/skills", body);
    return res.data.data.skill;
  },

  async patchSkill(
    id: number,
    body: Partial<{ name: string; proficiency: string | null; notes: string | null }>,
  ): Promise<UserSkillRow> {
    const res = await api.patch<ApiEnvelope<{ skill: UserSkillRow }>>(`/api/skills/${id}`, body);
    return res.data.data.skill;
  },

  async deleteSkill(id: number): Promise<void> {
    await api.delete(`/api/skills/${id}`);
  },

  async listCertifications(): Promise<UserCertificationRow[]> {
    const res = await api.get<ApiEnvelope<{ certifications: UserCertificationRow[] }>>("/api/certifications");
    return res.data.data.certifications;
  },

  async createCertification(
    body: {
      name: string;
      issuer?: string | null;
      credentialId?: string | null;
      issuedOn?: string | null;
      expiresOn?: string | null;
      notes?: string | null;
    },
    certificateFile?: File | null,
  ): Promise<UserCertificationRow> {
    if (certificateFile) {
      const fd = new FormData();
      appendCertificationFields(fd, body);
      fd.append("certificate", certificateFile);
      const res = await api.post<ApiEnvelope<{ certification: UserCertificationRow }>>("/api/certifications", fd);
      return res.data.data.certification;
    }
    const res = await api.post<ApiEnvelope<{ certification: UserCertificationRow }>>("/api/certifications", body);
    return res.data.data.certification;
  },

  async patchCertification(
    id: number,
    body: Partial<{
      name: string;
      issuer: string | null;
      credentialId: string | null;
      issuedOn: string | null;
      expiresOn: string | null;
      notes: string | null;
    }>,
    opts?: { certificateFile?: File | null; clearCertificate?: boolean },
  ): Promise<UserCertificationRow> {
    if (opts?.certificateFile || opts?.clearCertificate) {
      const fd = new FormData();
      if (body.name !== undefined) {
        fd.append("name", body.name);
      }
      if (body.issuer !== undefined) {
        fd.append("issuer", body.issuer ?? "");
      }
      if (body.credentialId !== undefined) {
        fd.append("credentialId", body.credentialId ?? "");
      }
      if (body.issuedOn !== undefined) {
        fd.append("issuedOn", body.issuedOn ?? "");
      }
      if (body.expiresOn !== undefined) {
        fd.append("expiresOn", body.expiresOn ?? "");
      }
      if (body.notes !== undefined) {
        fd.append("notes", body.notes ?? "");
      }
      if (opts.certificateFile) {
        fd.append("certificate", opts.certificateFile);
      }
      if (opts.clearCertificate) {
        fd.append("clearCertificate", "true");
      }
      const res = await api.patch<ApiEnvelope<{ certification: UserCertificationRow }>>(
        `/api/certifications/${id}`,
        fd,
      );
      return res.data.data.certification;
    }
    const res = await api.patch<ApiEnvelope<{ certification: UserCertificationRow }>>(
      `/api/certifications/${id}`,
      body,
    );
    return res.data.data.certification;
  },

  async deleteCertification(id: number): Promise<void> {
    await api.delete(`/api/certifications/${id}`);
  },

  async loadAll() {
    const [skills, certifications] = await Promise.all([this.listSkills(), this.listCertifications()]);
    return { skills, certifications };
  },
};
