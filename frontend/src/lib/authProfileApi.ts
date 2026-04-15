import { api } from "./api";

export async function uploadProfilePhoto(file: File): Promise<{ profilePhotoUrl: string }> {
  const fd = new FormData();
  fd.append("photo", file);
  const res = await api.post<{ success: boolean; data: { profilePhotoUrl: string }; message: string }>(
    "/api/auth/profile-photo",
    fd,
  );
  return res.data.data;
}
