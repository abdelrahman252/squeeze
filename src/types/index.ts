export type FileKind = "video" | "audio" | "image" | "pdf";

export type JobStatus =
  | "queued"
  | "probing"
  | "thumbnailing"
  | "ready"
  | "encoding"
  | "done"
  | "failed"
  | "cancelled";

export interface MediaProbe {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  pageCount?: number;
  bitrateKbps?: number;
  containerFormat?: string;
}

export interface JobOverrides {
  preset?: CompressionPreset;
  targetFileSize?: number;
  codec?: string;
  lossless?: boolean;
  resize?: boolean;
  targetFormat?: string;
  removeWatermarkX?: number;
  removeWatermarkY?: number;
  removeWatermarkW?: number;
  removeWatermarkH?: number;
  removeWatermarkPreset?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "custom";
  removeWatermarkShape?: "box" | "circle";
  removeWatermarkBand?: number;
}

export interface Job {
  // ── Identity ─────────────────────────────────────────────────────────────
  id: string;
  inputPath: string;       // absolute filesystem path
  name: string;            // display name (filename)
  outputPath?: string;
  kind: FileKind;
  addedAt: number;         // Date.now() when enqueued

  // ── State machine ─────────────────────────────────────────────────────────
  status: JobStatus;
  progress: number;        // 0–100 during encoding; 0 at all other stages
  speed?: string;          // e.g. "2.4x"   — populated during encoding
  etaSec?: number;         // seconds remaining — populated during encoding

  // ── Sizes ────────────────────────────────────────────────────────────────
  inputBytes: number;
  estimateBytes?: number;  // pre-job output size estimate (shown in queue row)
  outputBytes?: number;    // actual output size after encoding completes

  // ── Async data ─────────────────────────────────────────────────────────
  probe?: MediaProbe;
  /** undefined = thumbnail loading/pending; null = no thumbnail; string = cache path */
  thumbnailPath?: string | null;
  /** If true, start compression immediately when job becomes ready. Used for inline retry. */
  autoSqueeze?: boolean;
  errorMessage?: string;
  overrides?: JobOverrides;
  operation?: "compress" | "convert" | "remove-bg" | "enhance" | "remove-watermark";
  isDemoJob?: boolean;
}

export type CompressionPreset = "less" | "recommended" | "extreme" | "lossless";

export interface TargetFileSize {
  mode: "absolute" | "percent";
  value: number;
}

export interface Settings {
  preset: CompressionPreset;
  targetFileSize?: TargetFileSize;
  outputMode: "same-folder" | "subfolder" | "custom";
  customOutputDir?: string;
  filenamePattern: string;
  filenamePatternConvert?: string;
  filenamePatternRemoveBg?: string;
  filenamePatternEnhance?: string;
  filenamePatternRemoveWatermark?: string;
  removeBgFormat?: "png" | "webp" | "jpeg";
  removeBgBgType?: "transparent" | "color";
  removeBgBgColor?: string;
  removeBgModel?: "general" | "fine-detail";
  enhanceScale?: 2 | 4;
  enhanceFormat?: "png" | "webp" | "jpeg" | "original";
  enhanceCompress?: boolean;
  compressOnConvert?: boolean;
  parallelJobs: number;
  hasSeenTour: boolean;
  globalVideoFormat?: string;
  globalImageFormat?: string;
  globalAudioFormat?: string;
  resizeWidth?: number;
  resizeHeight?: number;
  audioCleanup: boolean;
  autoReframe: boolean;
  watermarkPath?: string;
  watermarkPos?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center";
  watermarkOpacity?: number;
  removeWatermarkPreset?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "custom";
  removeWatermarkX?: number;
  removeWatermarkY?: number;
  removeWatermarkW?: number;
  removeWatermarkH?: number;
  removeWatermarkBand?: number;
  removeWatermarkShape?: "box" | "circle";
  advanced: {
    video?: {
      codec?: "h264" | "h265" | "av1";
      crf?: number;
      targetResolution?: "original" | "4k" | "1080p" | "720p" | "480p" | "custom";
      fps?: number;
      hwEncoder?: "auto" | "nvenc" | "qsv" | "amf" | "none";
      audioKbps?: number;
      faststart?: boolean;
      stripMetadata?: boolean;
    };
    audio?: {
      codec?: "mp3" | "aac" | "opus" | "flac" | "wav";
      kbps?: number;
      sampleRate?: number;
    };
    image?: {
      format?: "keep" | "jpeg" | "png" | "webp" | "avif";
      quality?: number;
      resize?: { mode: "fit" | "exact" | "off"; w?: number; h?: number };
      stripMetadata?: boolean;
    };
    pdf?: {
      preset?: "screen" | "ebook" | "printer" | "prepress";
      dpi?: number;
      downsampleThreshold?: number;
    };
  };
}
