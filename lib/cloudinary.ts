export const MAX_CLOUDINARY_VIDEO_MB = 100; // Darmowy plan Cloudinary pozwala do 100 MB na plik wideo

export async function uploadVideoToCloudinary(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Brak konfiguracji Cloudinary (.env.local: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / UPLOAD_PRESET)."
    );
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_CLOUDINARY_VIDEO_MB) {
    throw new Error(
      `Plik jest za duży (${sizeMb.toFixed(1)} MB). Darmowy plan Cloudinary obsługuje pliki do ${MAX_CLOUDINARY_VIDEO_MB} MB.`
    );
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Wstrzykujemy automatyczną optymalizację formatu i jakości (f_auto,q_auto)
          const secureUrl: string = response.secure_url;
          const optimizedUrl = secureUrl.replace(
            "/video/upload/",
            "/video/upload/f_auto,q_auto/"
          );
          resolve(optimizedUrl);
        } catch {
          reject(new Error("Nieprawidłowa odpowiedź z serwera Cloudinary."));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData?.error?.message || "Błąd wysyłania wideo do Cloudinary."));
        } catch {
          reject(new Error(`Błąd wysyłania wideo (HTTP ${xhr.status}).`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Błąd połączenia z serwerem Cloudinary."));
    xhr.send(formData);
  });
}

export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes("res.cloudinary.com/") ||
    url.includes("/storage/v1/object/public/") ||
    /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url)
  );
}