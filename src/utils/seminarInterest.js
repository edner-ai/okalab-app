export const seminarInterestStatusOptions = ['new', 'contacted', 'closed', 'converted'];

export function getSeminarInterestSourceLabel(source, t) {
  const normalized = String(source || '').toLowerCase();
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
