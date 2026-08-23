import imageCompression from "browser-image-compression";

// Tunables for upload optimization. The app never renders a recipe photo wider
// than ~500px (≈1000px on retina), so capping the longest edge at 1600px keeps
// images visually identical while cutting stored size dramatically.
const MAX_EDGE = 1600; // longest side, px
const QUALITY = 0.8; // WebP quality (0–1)
const OUTPUT_TYPE = "image/webp";

/**
 * Resize + recompress an image to WebP in the browser before upload.
 *
 * Returns an optimized WebP `File` (renamed `*.webp` so Vercel Blob stores the
 * right pathname/contentType). On any failure it returns the original file
 * unchanged, so a quirky format never blocks an upload — worst case matches the
 * previous behavior of uploading the raw file.
 */
export async function optimizeImageForUpload(file: File): Promise<File> {
  try {
    let inputFile = file;

    // Check if the file is a HEIC/HEIF image
    if (
      inputFile.type === "image/heic" ||
      inputFile.type === "image/heif" ||
      inputFile.name.toLowerCase().endsWith(".heic") ||
      inputFile.name.toLowerCase().endsWith(".heif")
    ) {
      // Dynamically import heic2any to avoid loading it when not needed
      const heic2any = (await import("heic2any")).default;
      const convertedBlob = await heic2any({
        blob: inputFile,
        toType: "image/jpeg",
        quality: 1, // Max quality here, we'll compress in the next step
      });
      
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const base = inputFile.name.replace(/\.[^./\\]+$/, "");
      inputFile = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    }

    const compressed = await imageCompression(inputFile, {
      maxWidthOrHeight: MAX_EDGE,
      initialQuality: QUALITY,
      fileType: OUTPUT_TYPE,
      useWebWorker: true,
    });
    const base = inputFile.name.replace(/\.[^./\\]+$/, "");
    return new File([compressed], `${base}.webp`, { type: OUTPUT_TYPE });
  } catch (err) {
    console.warn("Image optimization failed, uploading original", err);
    return file;
  }
}
