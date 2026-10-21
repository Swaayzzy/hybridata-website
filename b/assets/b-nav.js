const menu = document.querySelector('.menu');
const nav = document.querySelector('.nav-links');
const serviceWrap = document.querySelector('.nav-service');
const serviceLink = serviceWrap?.querySelector('.nav-top-link');
const serviceToggle = document.querySelector('.services-toggle');
const serviceMega = document.querySelector('.services-mega');
let closeTimer;
let implicitOpen = false;
let suppressFocusOpen = false;

function isMobileNav() {
  return window.matchMedia('(max-width: 1020px)').matches;
}

function setServicesOpen(open, returnFocus = false) {
  if (!serviceWrap || !serviceToggle || !serviceMega) return;
  window.clearTimeout(closeTimer);
  serviceWrap.classList.toggle('is-open', open);
  serviceToggle.setAttribute('aria-expanded', String(open));
  if (returnFocus) (isMobileNav() ? serviceToggle : serviceLink)?.focus();
}

if (menu && nav) {
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    if (!open) setServicesOpen(false);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    setServicesOpen(false);
  }));
}

if (serviceWrap && serviceToggle && serviceMega) {
  serviceToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (implicitOpen) {
      implicitOpen = false;
      setServicesOpen(true);
    } else {
      setServicesOpen(serviceToggle.getAttribute('aria-expanded') !== 'true');
    }
  });
  serviceWrap.addEventListener('pointerenter', (event) => {
    if (!isMobileNav() && event.pointerType !== 'touch' && serviceToggle.getAttribute('aria-expanded') !== 'true') {
      implicitOpen = true;
      setServicesOpen(true);
    }
  });
  serviceWrap.addEventListener('pointerleave', (event) => {
    if (!isMobileNav() && event.pointerType !== 'touch') {
      closeTimer = window.setTimeout(() => { implicitOpen = false; setServicesOpen(false); }, 120);
    }
  });
  serviceWrap.addEventListener('focusin', () => {
    if (!isMobileNav() && !suppressFocusOpen && serviceToggle.getAttribute('aria-expanded') !== 'true') {
      implicitOpen = true;
      setServicesOpen(true);
    }
  });
  serviceWrap.addEventListener('focusout', (event) => {
    if (!isMobileNav() && !serviceWrap.contains(event.relatedTarget)) { implicitOpen = false; setServicesOpen(false); }
  });
  document.addEventListener('click', (event) => {
    if (!serviceWrap.contains(event.target)) { implicitOpen = false; setServicesOpen(false); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && serviceToggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      implicitOpen = false;
      suppressFocusOpen = true;
      setServicesOpen(false, true);
      window.setTimeout(() => { suppressFocusOpen = false; }, 0);
    }
  });
}

const intent = document.querySelector('#intent');
if (intent) {
  const requestedIntent = new URLSearchParams(window.location.search).get('intent');
  if (requestedIntent === 'site-survey' || requestedIntent === 'consultation') intent.value = requestedIntent;
}

function buildProjectMailto(data, recipients) {
  const cleanLine = (value) => String(value || '').replace(/[\r\n]+/g, ' ').trim();
  const labels = {
    request_intent: 'Request intent', contact_name: 'Name', company: 'Company',
    contact_email: 'Work email', phone: 'Phone', facility_location: 'Project city and state',
    number_of_locations: 'Number of locations', facility_type: 'Facility or environment',
    project_type: 'Service needed', project_model: 'Project model',
    equipment_status: 'Requirements status', project_stage: 'Project stage',
    target_schedule: 'Target schedule', project_notes: 'Project details',
  };
  const body = Object.entries(labels)
    .map(([key, label]) => `${label}: ${cleanLine(data[key]) || 'Not provided'}`)
    .join('\n');
  const subject = `Hybridata ${cleanLine(data.request_intent) || 'project'} request — ${cleanLine(data.company)}`;
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const form = document.querySelector('#survey-form');
if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.querySelector('#form-status');
    const button = form.querySelector('button[type=submit]');
    status.className = 'form-status';
    status.textContent = 'Validating project details…';
    if (!form.reportValidity()) {
      status.className = 'form-status error';
      status.textContent = 'Please complete the required project details.';
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const recipients = form.dataset.mailtoRecipients;
    const mailtoUrl = buildProjectMailto(data, recipients);
    form.dataset.generatedMailto = mailtoUrl;
    status.className = 'form-status success';
    status.textContent = 'Your email app is opening. Review the prepared message, then choose Send.';
    button.disabled = false;
    window.location.href = mailtoUrl;
  });
}
