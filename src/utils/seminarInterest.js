export const seminarInterestStatusOptions = ['new', 'contacted', 'closed', 'converted'];
export const INTEREST_SHARE_REQUEST_ID_KEY = "interest_share_request_id";
export const INTEREST_SHARE_SEMINAR_KEY = "interest_share_seminar";
export const INTEREST_INVITER_REQUEST_ID_KEY = "interest_inviter_request_id";
export const INTEREST_INVITER_SEMINAR_KEY = "interest_inviter_seminar";

export function getSeminarInterestSourceLabel(source, t) {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'prelaunch') {
    return t('seminar_interest_source_prelaunch', 'Proximamente');
  }
  if (normalized === 'full') {
    return t('seminar_interest_source_full', 'Cupos llenos');
  }
  return t('seminar_interest_source_completed', 'Seminario completado');
}

export function getSeminarInterestStatusLabel(status, t) {
  const normalized = String(status || '').toLowerCase();
  const map = {
    new: t('seminar_interest_status_new', 'Nuevo'),
    contacted: t('seminar_interest_status_contacted', 'Contactado'),
    closed: t('seminar_interest_status_closed', 'Cerrado'),
    converted: t('seminar_interest_status_converted', 'Convertido'),
  };
  return map[normalized] || (status || '');
}

export function getSeminarInterestStatusBadgeClass(status) {
  const normalized = String(status || '').toLowerCase();
  const map = {
    new: 'bg-sky-100 text-sky-700 border-sky-200',
    contacted: 'bg-amber-100 text-amber-800 border-amber-200',
    closed: 'bg-slate-200 text-slate-700 border-slate-300',
    converted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return map[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function buildCreateEditionUrl(seminarId, interestRequestId = "") {
  const params = new URLSearchParams();
  params.set("clone", seminarId);
  if (interestRequestId) {
    params.set("interest_request", interestRequestId);
  }
  return `/createseminar?${params.toString()}`;
}

export function buildInterestOnlyPublishUrl(seminarId, interestRequestId = "") {
  const params = new URLSearchParams();
  params.set("edit", seminarId);
  if (interestRequestId) {
    params.set("interest_request", interestRequestId);
  }
  return `/createseminar?${params.toString()}`;
}

export function buildSeminarInterestActionUrl(seminarId, sourceType, interestRequestId = "") {
  const normalized = String(sourceType || '').toLowerCase();
  if (normalized === 'prelaunch') {
    return buildInterestOnlyPublishUrl(seminarId, interestRequestId);
  }
  return buildCreateEditionUrl(seminarId, interestRequestId);
}

export function getSeminarInterestActionLabel(sourceType, t) {
  const normalized = String(sourceType || '').toLowerCase();
  if (normalized === 'prelaunch') {
    return t('seminar_open_enrollments', 'Definir fechas y abrir inscripciones');
  }
  return t('seminar_create_from_interest', 'Crear edicion');
}

export function buildInterestInviteUrl(seminarId, requestId) {
  const params = new URLSearchParams();
  if (requestId) {
    params.set("interest_ref", requestId);
  }
  return `/seminars/${seminarId}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function getStoredInterestShareRequestIdForSeminar(seminarId) {
  if (!seminarId) return null;
  return localStorage.getItem(INTEREST_SHARE_SEMINAR_KEY) === String(seminarId)
    ? localStorage.getItem(INTEREST_SHARE_REQUEST_ID_KEY)
    : null;
}

export function storeInterestShareRequestId({ seminarId, requestId }) {
  if (!seminarId || !requestId) return;
  localStorage.setItem(INTEREST_SHARE_SEMINAR_KEY, String(seminarId));
  localStorage.setItem(INTEREST_SHARE_REQUEST_ID_KEY, String(requestId));
}

export function getStoredInterestInviterRequestIdForSeminar(seminarId) {
  if (!seminarId) return null;
  return localStorage.getItem(INTEREST_INVITER_SEMINAR_KEY) === String(seminarId)
    ? localStorage.getItem(INTEREST_INVITER_REQUEST_ID_KEY)
    : null;
}

export function storeInterestInviterRequestId({ seminarId, requestId }) {
  if (!seminarId || !requestId) return;
  localStorage.setItem(INTEREST_INVITER_SEMINAR_KEY, String(seminarId));
  localStorage.setItem(INTEREST_INVITER_REQUEST_ID_KEY, String(requestId));
}

export function clearStoredInterestInviterRequestIdForSeminar(seminarId) {
  if (!seminarId) return;
  if (localStorage.getItem(INTEREST_INVITER_SEMINAR_KEY) !== String(seminarId)) return;
  localStorage.removeItem(INTEREST_INVITER_SEMINAR_KEY);
  localStorage.removeItem(INTEREST_INVITER_REQUEST_ID_KEY);
}
