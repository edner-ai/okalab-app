export function parseYouTubeVideoId(input) {
  if (!input) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const directMatch = raw.match(/^[A-Za-z0-9_-]{11}$/);
  if (directMatch) return directMatch[0];

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const segment = url.pathname.split("/").filter(Boolean)[0];
      return segment && /^[A-Za-z0-9_-]{11}$/.test(segment) ? segment : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const queryId = url.searchParams.get("v");
      if (queryId && /^[A-Za-z0-9_-]{11}$/.test(queryId)) {
        return queryId;
      }

      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.findIndex((part) => part === "embed" || part === "shorts");
      if (embedIndex >= 0) {
        const segment = pathParts[embedIndex + 1];
        return segment && /^[A-Za-z0-9_-]{11}$/.test(segment) ? segment : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildYouTubeWatchUrl(videoId) {
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
}

export function buildYouTubeEmbedUrl(videoId) {
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}

export function buildYouTubeThumbnailUrl(videoId, quality = "hqdefault") {
  return videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : "";
}

function normalizeStorageImageUrl(url, fallbackImage) {
  if (!url) return fallbackImage;

  const raw = String(url);
  const clean = raw.split("?")[0];

  if (clean.includes("/storage/v1/object/sign/")) {
    return clean.replace("/storage/v1/object/sign/", "/storage/v1/object/public/");
  }

  return raw;
}

export function normalizeSeminarCover(seminar, fallbackImage) {
  const coverType = seminar?.cover_type === "youtube" ? "youtube" : "image";
  const coverVideoId =
    seminar?.cover_video_id || parseYouTubeVideoId(seminar?.cover_video_url || seminar?.image_url);

  if (coverType === "youtube" && coverVideoId) {
    return {
      type: "youtube",
      videoId: coverVideoId,
      videoUrl: seminar?.cover_video_url || buildYouTubeWatchUrl(coverVideoId),
      imageSrc: buildYouTubeThumbnailUrl(coverVideoId),
    };
  }

  return {
    type: "image",
    videoId: null,
    videoUrl: null,
    imageSrc: normalizeStorageImageUrl(seminar?.image_url, fallbackImage),
  };
}

export function normalizeSeminarMaterial(material, index = 0) {
  if (!material || typeof material !== "object") return null;

  const fallbackTitle = `Material ${index + 1}`;
  const title = material.title || material.name || fallbackTitle;
  const rawType = String(material.type || "file").toLowerCase();
  const url = material.url || "";
  const youtubeVideoId = material.youtube_video_id || parseYouTubeVideoId(url);

  let type = rawType;
  if (type === "document") type = "file";
  if (type === "video" && youtubeVideoId) type = "youtube";
  if (!["file", "youtube", "link"].includes(type)) {
    type = youtubeVideoId ? "youtube" : url ? "link" : "file";
  }

  return {
    id: material.id || material.path || `${type}-${index}`,
    title,
    description: material.description || "",
    type,
    url: type === "youtube" && youtubeVideoId ? buildYouTubeWatchUrl(youtubeVideoId) : url,
    youtubeVideoId,
    mimeType: material.mime_type || "",
    bucket: material.bucket || "",
    path: material.path || "",
    isPreviewPublic: Boolean(material.is_preview_public ?? material.isPreviewPublic),
  };
}

export function normalizeSeminarMaterials(materials) {
  if (!Array.isArray(materials)) return [];
  return materials
    .map((material, index) => normalizeSeminarMaterial(material, index))
    .filter(Boolean);
}
