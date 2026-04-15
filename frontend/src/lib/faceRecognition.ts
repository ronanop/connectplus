import * as faceapi from "face-api.js";

let modelsLoaded = false;

export async function loadModels(onProgress?: (pct: number) => void): Promise<void> {
  if (modelsLoaded) {
    onProgress?.(100);
    return;
  }
  const nets = [
    faceapi.nets.ssdMobilenetv1,
    faceapi.nets.faceLandmark68Net,
    faceapi.nets.faceRecognitionNet,
  ];
  let loaded = 0;
  await Promise.all(
    nets.map(async net => {
      await net.loadFromUri("/models");
      onProgress?.(Math.round((++loaded / nets.length) * 100));
    }),
  );
  modelsLoaded = true;
}

export function resetModelsLoadedFlag(): void {
  modelsLoaded = false;
}

/** Resolve when the video element has non-zero intrinsic size (required for face-api / tfjs). */
export function waitForVideoDimensions(videoEl: HTMLVideoElement, timeoutMs = 15000): Promise<void> {
  const ready = () => videoEl.videoWidth > 2 && videoEl.videoHeight > 2;
  if (ready()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const done = () => {
      if (ready()) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      videoEl.removeEventListener("loadeddata", done);
      videoEl.removeEventListener("loadedmetadata", done);
      videoEl.removeEventListener("resize", done);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("VIDEO_NOT_READY"));
    }, timeoutMs);
    videoEl.addEventListener("loadeddata", done);
    videoEl.addEventListener("loadedmetadata", done);
    videoEl.addEventListener("resize", done);
  });
}

export function captureFrame(videoEl: HTMLVideoElement): HTMLCanvasElement {
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  if (w < 2 || h < 2) {
    throw new Error("VIDEO_NOT_READY");
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(videoEl, 0, 0);
  }
  return c;
}

export async function getDescriptorFromImage(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(source as HTMLVideoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("CAMERA_NOT_SUPPORTED");
  }
  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 },
    },
    audio: false,
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("muted", "");
    await videoEl.play();
    await waitForVideoDimensions(videoEl);
    return stream;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "VIDEO_NOT_READY") {
      throw err;
    }
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    const map: Record<string, string> = {
      NotAllowedError: "CAMERA_PERMISSION_DENIED",
      NotFoundError: "CAMERA_NOT_FOUND",
      NotReadableError: "CAMERA_IN_USE",
    };
    throw new Error(map[name] ?? "CAMERA_UNKNOWN_ERROR");
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach(t => t.stop());
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line|Twitter/.test(navigator.userAgent);
}

/** Optional live preview: detect face on canvas (not mirrored source). */
export async function detectFaceOnCanvas(
  canvas: HTMLCanvasElement,
): Promise<{ detected: boolean; confidence: number }> {
  if (canvas.width < 32 || canvas.height < 32) {
    return { detected: false, confidence: 0 };
  }
  const det = await faceapi.detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
  if (!det) {
    return { detected: false, confidence: 0 };
  }
  return { detected: true, confidence: det.score };
}
