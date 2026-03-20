export const VIDEO_CONFERENCE_PLATFORM_VALUES = ["zoom", "meet", "teams", "whatsapp", "other"];

export function getVideoConferencePlatformOptions(t) {
  return [
    { value: "zoom", icon: "📹", label: t("video_platform_zoom", "Zoom") },
    { value: "meet", icon: "🎥", label: t("video_platform_meet", "Google Meet") },
    { value: "teams", icon: "👥", label: t("video_platform_teams", "Microsoft Teams") },
    { value: "whatsapp", icon: "💬", label: t("video_platform_whatsapp", "WhatsApp") },
    { value: "other", icon: "💻", label: t("video_platform_other", "Otra") },
  ];
}

export function isCustomVideoConferencePlatform(value) {
  return value === "other";
}

export function supportsMeetingCredentials(value) {
  return value !== "whatsapp";
}

export function getVideoConferencePlatformLabel(seminarOrValue, t) {
  const value =
    typeof seminarOrValue === "string"
      ? seminarOrValue
      : seminarOrValue?.video_conference_platform;
  const customName =
    typeof seminarOrValue === "object"
      ? String(seminarOrValue?.video_conference_platform_custom_name || "").trim()
      : "";

  if (value === "other" && customName) {
    return customName;
  }

  return (
    {
      zoom: t("video_platform_zoom", "Zoom"),
      meet: t("video_platform_meet", "Google Meet"),
      teams: t("video_platform_teams", "Microsoft Teams"),
      whatsapp: t("video_platform_whatsapp", "WhatsApp"),
      other: t("video_platform_other", "Otra"),
    }[value] || t("videoConference", "Videoconferencia")
  );
}

export function getVideoConferencePlatformIcon(value) {
  return (
    {
      zoom: "📹",
      meet: "🎥",
      teams: "👥",
      whatsapp: "💬",
      other: "💻",
    }[value] || "💻"
  );
}

export function getMeetingLinkPlaceholder(platform, t) {
  return (
    {
      zoom: "https://zoom.us/j/...",
      meet: "https://meet.google.com/...",
      teams: "https://teams.microsoft.com/l/meetup-join/...",
      whatsapp: "https://call.whatsapp.com/...",
      other: t("meeting_link_placeholder", "Pega aqui el enlace de la reunion..."),
    }[platform] || t("meeting_link_placeholder", "Pega aqui el enlace...")
  );
}
