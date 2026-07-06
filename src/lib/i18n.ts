import { useLang } from "@/store/ui";

export type Language = "en" | "ar";

export const translations = {
  en: {
    title: "Squeeze",
    dropzoneTitle: "The file compressor that stays out of your way.",
    dropzoneSubtitle: "Drop any mix of videos, audio, images, and PDFs. Hit Squeeze. Done.",
    chooseFiles: "Choose Files",
    clearAll: "Clear All",
    squeeze: "Squeeze",
    
    // Filter Chips
    filterAll: "All",
    filterVideo: "Videos",
    filterAudio: "Audios",
    filterImage: "Images",
    filterPdf: "PDFs",

    // Presets
    presetLess: "Less Compression",
    presetRecommended: "Recommended",
    presetExtreme: "Extreme Compression",
    presetLossless: "Lossless",
    presetLessDesc: "Highest quality, larger files",
    presetRecDesc: "Best balance of quality and size",
    presetRecommendedDesc: "Best balance of quality and size",
    presetExtDesc: "Maximum space savings, lower quality",
    presetLosslessDesc: "Zero quality loss (images/PDFs only)",

    // Queue / Job Settings
    targetSize: "Target Size:",
    codec: "Codec:",
    format: "Format:",
    allowResize: "Allow Resize",
    presetOverride: "Preset Override:",
    useGlobalPreset: "Use Global Preset",
    none: "None",
    default: "Default",
    
    // Row status
    statusReady: "Ready",
    statusQueued: "Queued",
    statusAnalyzing: "Analyzing…",
    statusCompressing: "Compressing…",
    statusFailed: "Failed",
    statusDone: "Done",
    statusOptimal: "Already optimal",
    
    // Dropzone browser texts
    releaseToAdd: "Release to add",
    dropFilesHere: "Drop files here to compress them",
    videoAudioImagePdf: "Video · Audio · Image · PDF",
    releaseToAddEllipsis: "Release to add…",
    dropFilesAnywhere: "Drop files anywhere to add",
    addMore: "Add more…",
    openFiles: "Open files…",
    
    // Output controls
    outputFolder: "Output Folder",
    subfolderSqueeze: "Subfolder 'squeeze/'",
    sameFolder: "Same folder as input",
    customFolder: "Custom folder…",
    selectCustomFolder: "Select custom output directory",

    // Summary banner
    summaryTitle: "Squeeze Compression Summary",
    copiedSummary: "Copied summary to clipboard!",
    failedCopySummary: "Failed to copy summary",
    filesProcessed: "files processed",
    totalSaved: "Total Saved",
    copySummary: "Copy Summary",
    estimatingTotal: "Estimated total",
    original: "Original",

    // Advanced Drawer
    globalLabel: "Global",
    parallelJobs: "Parallel jobs",
    targetFileSizeOptional: "Target file size (optional)",
    advancedSettings: "Advanced Settings",
    videoSettings: "Video Settings",
    audioSettings: "Audio Settings",
    imageSettings: "Image Settings",
    pdfSettings: "PDF Settings",
    qualityLabel: "Quality",
    hwEncoder: "Hardware Encoder",
    targetResolution: "Target Resolution",
    fpsLabel: "FPS",
    faststartLabel: "Web Optimize (Faststart)",
    stripMetadataLabel: "Strip Metadata",
    resizeLabel: "Resize",
    bitrateLabel: "Bitrate",
    sampleRateLabel: "Sample Rate",
    dpiLabel: "DPI",
    downsampleThreshold: "Downsample Threshold",
    originalRes: "Original Resolution",
    customRes: "Custom...",
    compressionPreset: "Compression Preset",
    dpiOverride: "DPI Override",
    downsampleDesc: "Images above this DPI will be downsampled",
    lossless: "lossless",
    worst: "worst",
    best: "best",
    off: "Off",
    fitDimensions: "Fit within dimensions",
    exactDimensions: "Exact dimensions",
    noCap: "No cap",
    softwareOnly: "software only",
    webPlayback: "web playback",

    // Errors
    errorTitle: "Something went wrong",
    errorSubtitle: "Squeeze encountered an unexpected error and needs to restart.",
    restartButton: "Restart Squeeze",
    dropErrorTitle: "Unsupported file type",
    dropErrorDesc: "Squeeze handles video, audio, image, and PDF",
    openDialogError: "Opening files is only supported when running the Squeeze Desktop App!",
    previewBeforeAfter: "Preview Before/After",
    revealInExplorer: "Reveal in Explorer",
    removeFile: "Remove file",
    noFilesFilterVideo: "No video files in queue",
    noFilesFilterAudio: "No audio files in queue",
    noFilesFilterImage: "No image files in queue",
    noFilesFilterPdf: "No PDF files in queue",
    noFilesFilterAll: "No files in queue",
  },
  ar: {
    title: "سكويز",
    dropzoneTitle: "مكبس الملفات الذي لا يقف في طريقك.",
    dropzoneSubtitle: "اسحب وأسقط أي مزيج من الفيديوهات، الصوتيات، الصور، وملفات الـ PDF. ثم اضغط سكويز.",
    chooseFiles: "اختر الملفات",
    clearAll: "مسح الكل",
    squeeze: "اضغط (سكويز)",
    
    // Filter Chips
    filterAll: "الكل",
    filterVideo: "فيديو",
    filterAudio: "صوتيات",
    filterImage: "صور",
    filterPdf: "ملفات PDF",

    // Presets
    presetLess: "ضغط أقل",
    presetRecommended: "موصى به",
    presetExtreme: "ضغط فائق",
    presetLossless: "بدون فقدان الجودة",
    presetLessDesc: "أعلى جودة، حجم ملفات أكبر",
    presetRecDesc: "أفضل توازن بين الجودة والحجم",
    presetRecommendedDesc: "أفضل توازن بين الجودة والحجم",
    presetExtDesc: "توفير أقصى مساحة، جودة أقل",
    presetLosslessDesc: "صفر فقدان في الجودة (صور وPDF فقط)",

    // Queue / Job Settings
    targetSize: "الحجم المستهدف:",
    codec: "الترميز:",
    format: "الصيغة:",
    allowResize: "السماح بتغيير الحجم",
    presetOverride: "تجاوز الإعداد المسبق:",
    useGlobalPreset: "استخدام الإعداد العام",
    none: "بلا",
    default: "الافتراضي",
    
    // Row status
    statusReady: "جاهز",
    statusQueued: "في الانتظار",
    statusAnalyzing: "جاري التحليل…",
    statusCompressing: "جاري الضغط…",
    statusFailed: "فشل",
    statusDone: "مكتمل",
    statusOptimal: "مثالي بالفعل",
    
    // Dropzone browser texts
    releaseToAdd: "أفلت للإضافة",
    dropFilesHere: "اسحب وأسقط الملفات هنا لضغطها",
    videoAudioImagePdf: "فيديو · صوت · صورة · PDF",
    releaseToAddEllipsis: "أفلت للإضافة…",
    dropFilesAnywhere: "اسحب وأسقط الملفات في أي مكان للإضافة",
    addMore: "إضافة المزيد…",
    openFiles: "فتح ملفات…",
    
    // Output controls
    outputFolder: "مجلد الإخراج",
    subfolderSqueeze: "مجلد فرعي 'squeeze/'",
    sameFolder: "نفس مجلد الملف الأصلي",
    customFolder: "مجلد مخصص…",
    selectCustomFolder: "اختر مجلد الإخراج المخصص",

    // Summary banner
    summaryTitle: "ملخص ضغط سكويز",
    copiedSummary: "تم نسخ الملخص إلى الحافظة!",
    failedCopySummary: "فشل نسخ الملخص",
    filesProcessed: "ملفات تم معالجتها",
    totalSaved: "إجمالي المساحة الموفرة",
    copySummary: "نسخ الملخص",
    estimatingTotal: "الإجمالي التقديري",
    original: "الأصلي",

    // Advanced Drawer
    globalLabel: "عام",
    parallelJobs: "المهام المتوازية",
    targetFileSizeOptional: "حجم الملف المستهدف (اختياري)",
    advancedSettings: "الإعدادات المتقدمة",
    videoSettings: "إعدادات الفيديو",
    audioSettings: "إعدادات الصوت",
    imageSettings: "إعدادات الصور",
    pdfSettings: "إعدادات PDF",
    qualityLabel: "الجودة",
    hwEncoder: "المسرع العتادي (GPU)",
    targetResolution: "الدقة المستهدفة",
    fpsLabel: "معدل الإطارات (FPS)",
    faststartLabel: "تحسين الويب (Faststart)",
    stripMetadataLabel: "إزالة البيانات الوصفية (Metadata)",
    resizeLabel: "تغيير الحجم",
    bitrateLabel: "معدل البت (Bitrate)",
    sampleRateLabel: "معدل العينات (Sample Rate)",
    dpiLabel: "الدقة (DPI)",
    downsampleThreshold: "حد تقليل العينات",
    originalRes: "الدقة الأصلية",
    customRes: "مخصص...",
    compressionPreset: "الإعداد المسبق للضغط",
    dpiOverride: "تجاوز الـ DPI",
    downsampleDesc: "سيتم تقليل دقة الصور التي تتجاوز هذا الـ DPI",
    lossless: "بدون فقدان",
    worst: "الأسوأ",
    best: "الأفضل",
    off: "معطل",
    fitDimensions: "احتواء داخل الأبعاد",
    exactDimensions: "الأبعاد الدقيقة",
    noCap: "بدون حد",
    softwareOnly: "برمجي فقط",
    webPlayback: "تشغيل الويب",

    // Errors
    errorTitle: "حدث خطأ ما",
    errorSubtitle: "واجه تطبيق سكويز خطأً غير متوقع ويجب إعادة تشغيله.",
    restartButton: "إعادة تشغيل سكويز",
    dropErrorTitle: "نوع ملف غير مدعوم",
    dropErrorDesc: "يدعم سكويز ضغط الفيديو والصوت والصور وملفات الـ PDF",
    openDialogError: "ميزة فتح الملفات مدعومة فقط في تطبيق سطح المكتب لـ سكويز!",
    previewBeforeAfter: "معاينة قبل وبعد الضغط",
    revealInExplorer: "إظهار في مستكشف الملفات",
    removeFile: "إزالة الملف",
    noFilesFilterVideo: "لا توجد ملفات فيديو في قائمة الانتظار",
    noFilesFilterAudio: "لا توجد ملفات صوتية في قائمة الانتظار",
    noFilesFilterImage: "لا توجد صور في قائمة الانتظار",
    noFilesFilterPdf: "لا توجد ملفات PDF في قائمة الانتظار",
    noFilesFilterAll: "لا توجد ملفات في قائمة الانتظار",
  }
};

export function useTranslation() {
  const lang = useLang() as Language;
  const isRtl = lang === "ar";
  
  const t = (key: keyof typeof translations["en"]) => {
    return translations[lang][key] || translations["en"][key] || key;
  };
  
  return { t, lang, isRtl };
}
