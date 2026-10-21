const STATUS_LABELS = {
  found: 'Found',
  empty: 'Empty',
  failed: 'Failed',
  blocked: 'Blocked',
};

/** Prefer POST when share text is long enough that query strings may break. */
const POST_LOOKUP_MIN_CHARS = 180;

const form = document.querySelector('#lookup-form');
const input = document.querySelector('#number-input');
const submit = document.querySelector('#lookup-button');
const statusEl = document.querySelector('#status');
const resultEl = document.querySelector('#result');
const numberEl = document.querySelector('#result-number');
const headlineEl = document.querySelector('#result-headline');
const confidenceEl = document.querySelector('#result-confidence');
const sourcesEl = document.querySelector('#result-sources');

function setStatus(message, isError = false, isLoading = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
  statusEl.classList.toggle('loading', isLoading);
}

function readShareFields() {
  const params = new URLSearchParams(window.location.search);
  return {
    number: params.get('number'),
    text: params.get('text'),
    title: params.get('title'),
    url: params.get('url'),
  };
}

function previewShareInput(fields) {
  return [fields.number, fields.text, fields.title, fields.url]
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .join('\n');
}

function appendText(parent, tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

function renderResult(data) {
  resultEl.classList.add('visible');
  numberEl.textContent = data.numberE164;
  headlineEl.textContent = data.summary.headline;
  confidenceEl.textContent = data.summary.confidence;
  confidenceEl.className = `chip ${data.summary.confidence}`;
  sourcesEl.replaceChildren();

  for (const source of data.sources) {
    const li = document.createElement('li');
    li.className = 'source';

    const dot = document.createElement('span');
    dot.className = `source-dot ${source.status}`;
    dot.setAttribute('aria-hidden', 'true');
    li.appendChild(dot);

    const body = document.createElement('div');
    body.className = 'source-body';
    appendText(body, 'p', 'source-name', source.name);

    const detailBits = [];
    if (source.label) {
      detailBits.push(source.label);
    }
    if (source.detail) {
      detailBits.push(source.detail);
    }
    if (source.score !== undefined) {
      detailBits.push(`Score ${source.score}`);
    }
    appendText(body, 'p', 'source-detail', detailBits.join(' · ') || 'No details');
    li.appendChild(body);

    appendText(li, 'span', `badge ${source.status}`, STATUS_LABELS[source.status] || source.status);

    const link = document.createElement('a');
    link.className = 'source-link';
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open source';
    li.appendChild(link);

    sourcesEl.appendChild(li);
  }
}

async function requestLookup(payload) {
  const rawPreview = typeof payload === 'string' ? payload : previewShareInput(payload);
  if (!rawPreview.trim()) {
    setStatus('Enter a Spain phone number.', true);
    return;
  }

  submit.disabled = true;
  resultEl.classList.remove('visible');
  setStatus('Checking free Spain sources…', false, true);

  try {
    let response;
    if (typeof payload === 'string' && payload.trim().length < POST_LOOKUP_MIN_CHARS) {
      response = await fetch(`/api/lookup?number=${encodeURIComponent(payload.trim())}`);
    } else {
      const body =
        typeof payload === 'string'
          ? { number: payload.trim() }
          : {
              number: payload.number || undefined,
              text: payload.text || undefined,
              title: payload.title || undefined,
              url: payload.url || undefined,
            };
      response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || 'Lookup failed.', true);
      return;
    }
    setStatus('Done.');
    if (data.numberE164) {
      input.value = data.numberE164;
    }
    renderResult(data);
  } catch {
    setStatus('Network error. Try again.', true);
  } finally {
    submit.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  requestLookup(input.value);
});

const shareFields = readShareFields();
const sharedPreview = previewShareInput(shareFields);
if (sharedPreview) {
  input.value = sharedPreview;
  requestLookup(shareFields);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* install tip still works without SW */
    });
  });
}
