import imageCompression from "browser-image-compression";

export type CompressedImage = {
  file: File;
  width: number;
  height: number;
  size: number;
};

/**
 * Comprime imagem no navegador para upload em massa.
 * Máx 1600px no maior lado, ~1MB por arquivo.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: file.type.includes("png") ? "image/png" : "image/jpeg",
    initialQuality: 0.82,
  });
  const dims = await getImageDimensions(compressed);
  return { file: compressed, width: dims.width, height: dims.height, size: compressed.size };
}

function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao ler imagem"));
    };
    img.src = url;
  });
}

export async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
