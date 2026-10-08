import React, { useRef, useState } from "react";
import {
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Video,
  SwitchCamera,
  CheckCircle2,
} from "lucide-react";
import { PickedAsset, AssetSource } from "../types";

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetSelected?: (asset: PickedAsset) => void;
  onSelectAsset?: (asset: PickedAsset) => void;
  onPreviewAsset?: (asset: PickedAsset) => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  onAssetSelected,
  onSelectAsset,
  onPreviewAsset,
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // Live in-app camera state for devices/browsers where live video stream is preferred
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close live camera stream safely
  const stopLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsLiveCameraActive(false);
    setCameraError(null);
  };

  // Start live camera stream
  const startLiveCamera = async (facing: "user" | "environment" = cameraFacingMode) => {
    try {
      setCameraError(null);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setCameraStream(stream);
      setIsLiveCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn("Video play error:", e));
      }
    } catch (err: any) {
      console.warn("Camera live stream failed, falling back to system camera input:", err);
      // If live camera cannot be accessed (permission or device restriction), trigger native camera input
      setIsLiveCameraActive(false);
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  // Switch between front and back camera in live mode
  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextFacing);
    await startLiveCamera(nextFacing);
  };

  // Snap photo from live video feed
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.92);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const asset: PickedAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `camera-photo-${timestamp}.jpg`,
      size: Math.round((base64Data.length * 3) / 4),
      type: "image/jpeg",
      source: "camera",
      previewUrl: base64Data,
      base64Data,
      isImage: true,
      isTextFile: false,
    };

    stopLiveCamera();
    onClose();
    if (onPreviewAsset) {
      onPreviewAsset(asset);
    } else if (onSelectAsset) {
      onSelectAsset(asset);
    } else if (onAssetSelected) {
      onAssetSelected(asset);
    }
  };

  if (!isOpen) return null;

  // Process a chosen File object from any input
  const handleFileProcess = async (file: File, source: AssetSource) => {
    const isImg = file.type.startsWith("image/");
    const isTxt =
      file.type.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".js") ||
      file.name.endsWith(".ts") ||
      file.name.endsWith(".html") ||
      file.name.endsWith(".css");

    let previewUrl: string | undefined;
    let base64Data: string | undefined;
    let textSnippet: string | undefined;

    if (isImg) {
      // Read as Data URL for preview and API
      const reader = new FileReader();
      const loadPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      base64Data = await loadPromise;
      previewUrl = base64Data;
    } else if (isTxt) {
      // Read as text
      const reader = new FileReader();
      const loadPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsText(file);
      textSnippet = await loadPromise;
    } else {
      // General binary file / document preview
      previewUrl = URL.createObjectURL(file);
    }

    const asset: PickedAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      source,
      previewUrl,
      base64Data,
      textSnippet,
      isImage: isImg,
      isTextFile: isTxt,
    };

    onClose();
    if (onPreviewAsset && (isImg || file.name.endsWith(".pdf") || isTxt)) {
      onPreviewAsset(asset);
    } else if (onSelectAsset) {
      onSelectAsset(asset);
    } else if (onAssetSelected) {
      onAssetSelected(asset);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, source: AssetSource) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0], source);
    }
    // Reset input value so same file can be selected again if desired
    e.target.value = "";
  };

  // Handle Camera option click:
  // On mobile touch devices, standard HTML5 capture opens the camera app directly.
  // We can also allow live viewfinder if user desires.
  const handleCameraOptionClick = () => {
    // Check if device is mobile
    const isTouchOrMobile =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isTouchOrMobile && cameraInputRef.current) {
      // Open native mobile camera directly
      cameraInputRef.current.click();
    } else {
      // Start live camera viewfinder
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startLiveCamera();
      } else if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  return (
    <div
      id="asset-picker-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopLiveCamera();
          onClose();
        }
      }}
    >
      <div
        id="asset-picker-card"
        className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 id="asset-picker-title" className="text-base font-bold text-white flex items-center gap-2">
              <span>Asset Picker</span>
            </h2>
            <p className="text-xs text-slate-400">
              Select an option to add content to LexisAi
            </p>
          </div>
          <button
            id="close-asset-picker-btn"
            type="button"
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer active:scale-95 transition-colors"
            aria-label="Close Asset Picker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Camera Viewfinder (if active) */}
        {isLiveCameraActive ? (
          <div className="p-4 flex flex-col items-center gap-3 bg-black">
            <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-sm border border-white/20 transition-all cursor-pointer active:scale-95"
                  title="Switch Camera"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>
            </div>

            {cameraError && (
              <div className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex items-center justify-between w-full pt-2">
              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl min-h-[44px]"
              >
                Cancel
              </button>

              <button
                id="snap-photo-btn"
                type="button"
                onClick={captureSnapshot}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/40 min-h-[44px] active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Photo</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main 3 Options List */
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {/* Option 1: 📁 Upload */}
            <button
              id="asset-option-upload"
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="group flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/50 transition-all text-left cursor-pointer active:scale-98 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:bg-blue-500/20 transition-all shrink-0">
                <span className="text-xl">📁</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                    Upload
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md">
                    Files & Docs
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Select a file, document, text, or notes from your device
                </p>
              </div>
            </button>

            {/* Option 2: 📷 Camera */}
            <button
              id="asset-option-camera"
              type="button"
              onClick={handleCameraOptionClick}
              className="group flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 transition-all text-left cursor-pointer active:scale-98 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-500/20 transition-all shrink-0">
                <span className="text-xl">📷</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Camera
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md">
                    Snap Photo
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Take a photo directly using your camera
                </p>
              </div>
            </button>

            {/* Option 3: 🖼️ Photos */}
            <button
              id="asset-option-photos"
              type="button"
              onClick={() => photosInputRef.current?.click()}
              className="group flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/50 transition-all text-left cursor-pointer active:scale-98 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 group-hover:bg-purple-500/20 transition-all shrink-0">
                <span className="text-xl">🖼️</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    Photos
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-md">
                    Gallery
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Choose an existing photo or image from your gallery
                </p>
              </div>
            </button>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-500">
                LexisAi automatically analyzes documents and extracts text from images
              </span>
            </div>
          </div>
        )}

        {/* Hidden File Inputs */}
        {/* 1. Upload (all file formats, documents, text, code, images) */}
        <input
          ref={uploadInputRef}
          type="file"
          id="file-input-upload"
          className="hidden"
          accept="*/*"
          onChange={(e) => handleInputChange(e, "upload")}
        />

        {/* 2. Camera (direct capture environment on mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          id="file-input-camera"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleInputChange(e, "camera")}
        />

        {/* 3. Photos (gallery/photo library) */}
        <input
          ref={photosInputRef}
          type="file"
          id="file-input-photos"
          className="hidden"
          accept="image/*"
          onChange={(e) => handleInputChange(e, "photos")}
        />
      </div>
    </div>
  );
};
