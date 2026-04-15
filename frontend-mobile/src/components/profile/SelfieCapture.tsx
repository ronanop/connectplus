import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  captureFrame,
  detectFaceOnCanvas,
  getDescriptorFromImage,
  isInAppBrowser,
  loadModels,
  startCamera,
  stopCamera,
} from "../../lib/faceRecognition";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: (jpegBlob: Blob, descriptor: number[]) => Promise<void>;
};

export function SelfieCapture({ open, onClose, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"idle" | "live" | "preview">("idle");
  const [saving, setSaving] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceOk, setFaceOk] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopCamera(stream);
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (!open) {
      cleanupStream();
      setPhase("idle");
      setFaceOk(false);
      setPreviewUrl(prev => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setCapturedDescriptor(null);
    }
  }, [open, cleanupStream]);

  const handleStartCamera = async () => {
    if (isInAppBrowser()) {
      toast.error("Please open ConnectPlus in Safari or Chrome for camera access.");
      return;
    }
    const v = videoRef.current;
    if (!v) {
      return;
    }
    try {
      await loadModels();
      const s = await startCamera(v);
      setStream(s);
      setPhase("live");
      intervalRef.current = setInterval(async () => {
        try {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            return;
          }
          const canvas = captureFrame(videoRef.current);
          const { detected, confidence } = await detectFaceOnCanvas(canvas);
          setFaceOk(detected && confidence >= 0.5);
        } catch {
          /* skip frame */
        }
      }, 800);
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : "CAMERA_UNKNOWN_ERROR";
      toast.error(code.replace(/_/g, " "));
    }
  };

  const handleCapture = async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) {
      return;
    }
    try {
      await loadModels();
      const canvas = captureFrame(v);
      const desc = await getDescriptorFromImage(canvas);
      if (!desc) {
        toast.warning("No face detected. Adjust lighting or position.");
        return;
      }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) {
        toast.error("Could not capture image.");
        return;
      }
      cleanupStream();
      setCapturedDescriptor(Array.from(desc));
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase("preview");
    } catch {
      toast.error("Capture failed");
    }
  };

  const handleConfirm = async () => {
    if (!previewUrl || !capturedDescriptor) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      await onComplete(blob, capturedDescriptor);
      onClose();
    } catch {
      toast.error("Could not save photo");
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCapturedDescriptor(null);
    setPhase("idle");
    setFaceOk(false);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-black/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex shrink-0 items-center justify-between p-4 pt-[max(1rem,var(--safe-top))] text-white">
            <span className="text-sm font-medium">Take selfie</span>
            <button
              type="button"
              aria-label="Close"
              className="mobile-tap rounded-full p-2 hover:bg-white/10"
              onClick={() => {
                cleanupStream();
                onClose();
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden px-3 pb-[max(1.5rem,var(--safe-bottom))] sm:px-4">
            {phase === "preview" && previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[min(50vh,_calc(100dvh-12rem))] max-w-full rounded-2xl object-contain"
                />
                <div className="flex w-full max-w-sm flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    className="mobile-tap mobile-tap-strong min-h-[48px] rounded-xl border border-white/30 px-6 text-white"
                    onClick={handleRetake}
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    className="mobile-tap mobile-tap-strong min-h-[48px] rounded-xl bg-emerald-600 px-6 font-medium text-white disabled:opacity-50"
                    onClick={handleConfirm}
                  >
                    Use this photo
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative mx-auto aspect-square w-full max-w-[min(300px,_calc(100vw-1.5rem))] overflow-hidden rounded-full border-4 border-white/20 bg-neutral-900 sm:max-w-[min(360px,_calc(100vw-2rem))]">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                    autoPlay
                    playsInline
                    muted
                  />
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    aria-hidden
                  >
                    <ellipse
                      cx="50"
                      cy="50"
                      rx="38"
                      ry="48"
                      fill="none"
                      stroke={faceOk ? "#22c55e" : "rgba(255,255,255,0.5)"}
                      strokeWidth="0.8"
                      strokeDasharray={faceOk ? "0" : "2 2"}
                    />
                  </svg>
                </div>
                <p className="max-w-full px-2 text-center text-sm text-white/80" aria-live="polite">
                  {phase === "idle" && "Tap the button to start the camera."}
                  {phase === "live" &&
                    (faceOk ? "Hold still and tap Capture" : "Position your face in the oval")}
                </p>
                {phase === "idle" ? (
                  <button
                    type="button"
                    aria-label="Use camera"
                    className="mobile-tap mobile-tap-strong flex min-h-[48px] min-w-[48px] items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900"
                    onClick={handleStartCamera}
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    Use camera
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Capture photo"
                    disabled={!faceOk}
                    className="mobile-tap mobile-tap-strong flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg disabled:opacity-40"
                    onClick={handleCapture}
                  >
                    <span className="h-10 w-10 rounded-full border-4 border-white" />
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
