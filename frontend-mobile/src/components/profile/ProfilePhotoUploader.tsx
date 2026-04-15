import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Upload } from "lucide-react";
import { toast } from "react-toastify";
import { uploadProfilePhoto } from "../../lib/authProfileApi";
import { attendanceApi } from "../../lib/attendanceApi";
import { getDescriptorFromImage, loadModels } from "../../lib/faceRecognition";
import { SelfieCapture } from "./SelfieCapture";

type Props = {
  userName: string;
  profilePhotoUrl: string | null | undefined;
  hasFaceRegistered?: boolean;
  faceEnrolledAt?: string | null;
};

async function trySaveDescriptorFromFile(file: File): Promise<boolean> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
  });
  try {
    await loadModels();
    const d = await getDescriptorFromImage(img);
    if (!d) {
      return false;
    }
    await attendanceApi.saveFaceDescriptor(Array.from(d));
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProfilePhotoUploader({
  userName,
  profilePhotoUrl,
  hasFaceRegistered,
  faceEnrolledAt,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const invalidateProfile = () => {
    void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  };

  const handleFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      await uploadProfilePhoto(file);
      const ok = await trySaveDescriptorFromFile(file);
      if (ok) {
        toast.success("Profile photo updated. Your face is now registered for attendance.");
      } else {
        toast.success("Profile photo updated.");
        toast.warning(
          "No face detected in this photo. Please upload a clear front-facing photo or use the camera to take a selfie. Attendance verification requires a photo with a visible face.",
        );
      }
      invalidateProfile();
    } catch {
      toast.error("Could not upload photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleSelfieComplete = async (blob: Blob, descriptor: number[]) => {
    const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
    await uploadProfilePhoto(file);
    await attendanceApi.saveFaceDescriptor(descriptor);
    toast.success("Profile photo updated. Your face is now registered for attendance.");
    invalidateProfile();
  };

  const enrolledLabel =
    hasFaceRegistered && faceEnrolledAt
      ? new Date(faceEnrolledAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;

  return (
    <div className="max-w-full rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Profile photo</h2>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-gold)]/20 text-[var(--accent-primary)]">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt=""
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <span className="text-3xl font-semibold">{userName?.charAt(0).toUpperCase() || "U"}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => void handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={uploading}
              className="mobile-tap mobile-tap-strong inline-flex min-h-[48px] max-w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 shrink-0" />
              Upload photo
            </button>
            <button
              type="button"
              disabled={uploading}
              className="mobile-tap mobile-tap-strong inline-flex min-h-[48px] max-w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
              onClick={() => setSelfieOpen(true)}
            >
              <Camera className="h-4 w-4 shrink-0" />
              Take selfie
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            JPEG, PNG or Webp, max 5MB. A clear front-facing photo enables attendance face verification.
          </p>
          <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--bg-elevated)]/50 px-3 py-2 text-sm text-[var(--text-primary)]">
            <span className="font-medium">Attendance Face ID: </span>
            {hasFaceRegistered ? (
              <span className="text-emerald-600">Registered{enrolledLabel ? ` (set ${enrolledLabel})` : ""}</span>
            ) : (
              <span className="text-amber-600">Not set — take a selfie or upload a clear photo</span>
            )}
          </div>
        </div>
      </div>

      <SelfieCapture
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onComplete={handleSelfieComplete}
      />
    </div>
  );
}
