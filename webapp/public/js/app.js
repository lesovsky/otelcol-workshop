/* ============================================
   PG + OTel Workshop — SPA Application
   ============================================ */

// ---- Polygon Network Background ----
function createPolyNetwork(container, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;opacity:0;transition:opacity 0.6s ease;';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Colors — warm orange accent
  const primaryR = 251, primaryG = 146, primaryB = 60;   // bright orange
  const accentR = 234, accentG = 88, accentB = 12;       // deep orange

  let nodes = [];
  let edges = [];
  let w, h;

  function resize() {
    const rect = container.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateNodes();
    computeEdges();
  }

  function generateNodes() {
    nodes = [];
    // Density increases toward bottom-right corner
    // Use variable grid spacing: dense at bottom-right, sparse at top-left
    const baseSpacing = opts.baseSpacing || 80;
    const minSpacing = opts.minSpacing || 30;

    // Fill area with nodes, spacing varies by distance to bottom-right
    const maxDist = Math.sqrt(w * w + h * h);

    for (let attempts = 0; attempts < 800; attempts++) {
      const x = Math.random() * w;
      const y = Math.random() * h;

      // Distance from bottom-right (normalized 0..1, 0 = at corner)
      const dx = (w - x) / w;
      const dy = (h - y) / h;
      const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2; // 0..1

      // Probability of keeping this node: high near bottom-right, low at top-left
      const keepProb = Math.pow(1 - dist, 1.8) * 0.9 + 0.05;
      if (Math.random() > keepProb) continue;

      // Check minimum distance to existing nodes (also varies)
      const localMin = minSpacing + dist * (baseSpacing - minSpacing);
      let tooClose = false;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < localMin) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Color: blend primary→accent based on position
      const blend = (x / w) * 0.5 + (y / h) * 0.5;
      const r = primaryR + (accentR - primaryR) * blend;
      const g = primaryG + (accentG - primaryG) * blend;
      const b = primaryB + (accentB - primaryB) * blend;

      // Opacity: stronger near bottom-right
      const opacity = (1 - dist) * 0.5 + 0.05;

      nodes.push({ x, y, r, g, b, opacity, dist });
    }
  }

  function computeEdges() {
    edges = [];
    const maxEdgeDist = opts.maxEdgeDist || 120;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        // Edge distance threshold: shorter near top-left, longer near bottom-right
        const avgDist = (nodes[i].dist + nodes[j].dist) / 2;
        const threshold = maxEdgeDist * (1 - avgDist * 0.5);
        if (d < threshold) {
          edges.push({ a: i, b: j, d });
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Draw edges
    for (const e of edges) {
      const a = nodes[e.a];
      const b = nodes[e.b];
      const opacity = Math.min(a.opacity, b.opacity) * 0.4;
      const midR = (a.r + b.r) / 2;
      const midG = (a.g + b.g) / 2;
      const midB = (a.b + b.b) / 2;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${midR|0},${midG|0},${midB|0},${opacity})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      // Outer glow
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.r|0},${n.g|0},${n.b|0},${n.opacity * 0.3})`;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.r|0},${n.g|0},${n.b|0},${n.opacity})`;
      ctx.fill();
    }
  }

  resize();
  draw();

  // Fade in after first draw
  requestAnimationFrame(() => { canvas.style.opacity = '1'; });

  // Debounced resize
  let resizeTimer;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); draw(); }, 150);
  });
  ro.observe(container);

  return { destroy: () => { ro.disconnect(); canvas.remove(); } };
}

// Content flow definition
const CONTENT_FLOW = [
  { id: 'intro', label: 'Введение в OpenTelemetry', parts: [
    { type: 'slides', source: 'content/slides/01-intro-otel.md' },
  ]},
  { id: 'setup', label: 'Подготовка окружения', parts: [
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [0, 1] },
  ]},
  { id: 'collector', label: 'PGPRO OTEL Collector', parts: [
    { type: 'slides', source: 'content/slides/02-pgpro-otel-collector.md' },
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [2] },
  ]},
  { id: 'victoriametrics', label: 'Метрики → VictoriaMetrics', parts: [
    { type: 'slides', source: 'content/slides/03-victoriametrics.md' },
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [3] },
  ]},
  { id: 'victorialogs', label: 'Логи → VictoriaLogs', parts: [
    { type: 'slides', source: 'content/slides/04-victorialogs.md' },
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [4] },
  ]},
  { id: 'visualization', label: 'Визуализация в Grafana', parts: [
    { type: 'slides', source: 'content/slides/05-visualization.md' },
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [5] },
  ]},
  { id: 'troubleshooting', label: 'Траблшутинг', parts: [
    { type: 'guide', source: 'content/guide/workshop-guide.md', sections: [6] },
  ]},
  { id: 'summary', label: 'Итоги и что дальше', parts: [
    { type: 'slides', source: 'content/slides/06-summary.md' },
  ]},
];

const SERVICE_NAMES = {
  'otel-collector': 'OTel Collector',
  'victoriametrics': 'VictoriaMetrics',
  'victorialogs': 'VictoriaLogs',
  'grafana': 'Grafana',
  'postgres': 'PostgreSQL',
};

// State
let steps = [];
let currentStep = 0;
let contentMode = 'short';
let detailedAvailable = new Set();
let detailedContent = {};

// ---- Markdown Setup ----
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: false,
  gfm: true
});

// ---- Content Loading ----
async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  return resp.text();
}

async function fetchJSON(url) {
  const resp = await fetch(url);
  return resp.json();
}

function stripMarpFrontmatter(md) {
  return md.replace(/^---\nmarp:.*?\n---\n*/s, '');
}

function splitSlides(md) {
  const cleaned = stripMarpFrontmatter(md);
  return cleaned.split(/\n---\n/).map(s => s.trim()).filter(s => s.length > 0);
}

function splitGuideSections(md) {
  const sections = [];
  const regex = /^## (\d+)\. /gm;
  let match;
  const indices = [];

  while ((match = regex.exec(md)) !== null) {
    indices.push({ index: match.index, num: parseInt(match[1]) });
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index;
    const end = i + 1 < indices.length ? indices[i + 1].index : md.length;
    sections.push({ num: indices[i].num, content: md.substring(start, end).trim() });
  }

  return sections;
}

function splitGuideSubsections(content) {
  const lines = content.split('\n');
  const chunks = [];
  let current = [];
  let firstChunkDone = false;

  for (const line of lines) {
    if (line.match(/^### /) && firstChunkDone) {
      if (current.length > 0) chunks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
      if (line.match(/^## /)) firstChunkDone = true;
    }
  }

  if (current.length > 0) {
    const text = current.join('\n').trim();
    if (text) chunks.push(text);
  }

  return chunks.length > 0 ? chunks : [content];
}

function extractTitle(md) {
  const match = md.match(/^#{1,3}\s+(.+)$/m);
  if (!match) return '';
  return match[1].replace(/\*\*/g, '').replace(/^\d+\.\s+/, '');
}

// Strip section numbers from guide headings before rendering
function stripSectionNumbers(md) {
  return md.replace(/^(#{1,3})\s+\d+\.\s+/gm, '$1 ');
}

async function loadAllContent() {
  // Collect all unique sources
  const sources = {};
  for (const section of CONTENT_FLOW) {
    for (const part of section.parts) {
      if (!sources[part.source]) sources[part.source] = fetchText(part.source);
    }
  }

  const loaded = {};
  for (const [url, promise] of Object.entries(sources)) {
    loaded[url] = await promise;
  }

  // Check which detailed files exist
  try {
    const detailedInfo = await fetchJSON('/api/content/detailed');
    detailedAvailable = new Set(detailedInfo.available || []);
  } catch { /* no detailed available */ }

  const guideUrl = 'content/guide/workshop-guide.md';
  const guideSections = splitGuideSections(loaded[guideUrl]);

  steps = [];

  // Welcome
  steps.push({
    type: 'welcome', title: 'Начало', html: '',
    sectionId: 'welcome', sectionLabel: 'Начало', sourceFile: null
  });

  for (const section of CONTENT_FLOW) {
    for (const part of section.parts) {
      if (part.type === 'slides') {
        const slides = splitSlides(loaded[part.source]);
        const sourceBase = part.source.replace('content/slides/', '').replace('.md', '');

        slides.forEach((slideContent, i) => {
          steps.push({
            type: 'theory',
            title: extractTitle(slideContent) || section.label,
            html: marked.parse(slideContent),
            sectionId: section.id,
            sectionLabel: section.label,
            sourceFile: sourceBase,
            slideIndex: i,
            shortContent: slideContent
          });
        });
      } else if (part.type === 'guide') {
        for (const secNum of part.sections) {
          const guideSection = guideSections.find(s => s.num === secNum);
          if (guideSection) {
            const subSections = splitGuideSubsections(guideSection.content);
            subSections.forEach(sub => {
              const cleaned = stripSectionNumbers(sub);
              const title = extractTitle(cleaned) || section.label;
              // "Итоги" sections are theory, not practice
              const stepType = /^Итоги/.test(title) ? 'theory' : 'practice';
              steps.push({
                type: stepType,
                title: title,
                html: marked.parse(cleaned),
                sectionId: section.id,
                sectionLabel: section.label,
                sourceFile: null
              });
            });
          }
        }
      }
    }
  }
}

// ---- Detailed Content ----
async function loadDetailedForSource(sourceBase) {
  if (detailedContent[sourceBase]) return detailedContent[sourceBase];
  try {
    const md = await fetchText(`content/slides/${sourceBase}.detailed.md`);
    const slides = splitSlides(md);
    detailedContent[sourceBase] = slides;
    return slides;
  } catch {
    return null;
  }
}

async function getStepHtml(step) {
  if (step.type !== 'theory' || contentMode === 'short' || !step.sourceFile) {
    return step.html;
  }

  if (!detailedAvailable.has(step.sourceFile)) {
    return step.html;
  }

  const detailedSlides = await loadDetailedForSource(step.sourceFile);
  if (detailedSlides && detailedSlides[step.slideIndex]) {
    return marked.parse(detailedSlides[step.slideIndex]);
  }

  return step.html;
}

// ---- Content Mode Toggle ----
function setContentMode(mode) {
  contentMode = mode;
  localStorage.setItem('workshop-mode', mode);
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderStep(currentStep);
}

function updateDetailToggle(step) {
  const toggle = document.getElementById('detail-toggle');
  if (step.type === 'theory' && step.sourceFile && detailedAvailable.has(step.sourceFile)) {
    toggle.style.display = '';
  } else {
    toggle.style.display = 'none';
  }
}

// ---- Rendering ----
async function renderStep(index) {
  const step = steps[index];
  const contentEl = document.getElementById('content');

  updateDetailToggle(step);

  if (step.type === 'welcome') {
    contentEl.innerHTML = `
      <div class="content-inner">
        <div class="welcome">
          <svg class="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <h1>Мониторинг PostgreSQL<br>с OpenTelemetry</h1>
          <p class="subtitle">Интерактивный воркшоп</p>
          <button class="start-btn" onclick="goToStep(1)">
            Начать воркшоп
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div class="shortcuts-hint">
            <span><kbd>&larr;</kbd> <kbd>&rarr;</kbd> навигация</span>
            <span><kbd>S</kbd> боковая панель</span>
          </div>
        </div>
      </div>`;

    // Add polygon network to welcome
    const welcomeEl = contentEl.querySelector('.welcome');
    if (welcomeEl) {
      const bg = document.createElement('div');
      bg.className = 'welcome-bg';
      welcomeEl.appendChild(bg);
      if (window._polyNet) window._polyNet.destroy();
      window._polyNet = createPolyNetwork(bg, { baseSpacing: 90, minSpacing: 35 });
    }
  } else {
    // Destroy poly network on non-title/welcome slides
    if (window._polyNet) { window._polyNet.destroy(); window._polyNet = null; }

    const html = await getStepHtml(step);
    const badgeType = step.type === 'theory' ? 'theory' : 'practice';
    const badgeLabel = step.type === 'theory' ? 'Теория' : 'Практика';

    const isTitleSlide = step.type === 'theory' && step.slideIndex === 0;
    const innerClass = isTitleSlide ? 'content-inner title-slide' : 'content-inner';

    contentEl.innerHTML = `
      <div class="${innerClass}">
        <div class="step-badge ${badgeType}">${badgeLabel}</div>
        ${html}
      </div>`;

    // For title slides: wrap everything after h1 into title-slide-footer + add poly bg
    if (isTitleSlide) {
      const inner = contentEl.querySelector('.title-slide');
      const h1 = inner.querySelector('h1');
      if (h1 && !inner.querySelector('.title-slide-footer')) {
        const footer = document.createElement('div');
        footer.className = 'title-slide-footer';
        let sibling = h1.nextElementSibling;
        while (sibling) {
          const next = sibling.nextElementSibling;
          footer.appendChild(sibling);
          sibling = next;
        }
        inner.appendChild(footer);
      }
      // Add polygon network background
      const bg = document.createElement('div');
      bg.className = 'title-slide-bg';
      inner.appendChild(bg);
      if (window._polyNet) window._polyNet.destroy();
      window._polyNet = createPolyNetwork(bg);
    }
  }

  // Copy + View buttons on code blocks
  const configFile = SECTION_CONFIG_FILES[step.sectionId] || null;

  contentEl.querySelectorAll('pre code').forEach(block => {
    const pre = block.parentElement;
    pre.style.position = 'relative';

    // Detect ASCII diagrams (box-drawing characters)
    if (/[┌┐└┘│─├┤▸◂▸═║╔╗╚╝]/.test(block.textContent)) {
      block.classList.add('ascii-diagram');
    }

    // Button container (top-right)
    const btnGroup = document.createElement('div');
    btnGroup.className = 'code-btn-group';

    // Run button (for curl commands that can be proxied)
    const runnable = findRunnableCommand(block.textContent);
    if (runnable) {
      const runBtn = document.createElement('button');
      runBtn.className = 'code-action-btn run-btn';
      runBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run`;
      runBtn.onclick = () => runCommand(runnable.api, runnable.label);
      btnGroup.appendChild(runBtn);
    }

    // View button (for config-like YAML blocks)
    if (configFile && isConfigBlock(block.textContent)) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'code-action-btn view-btn';
      viewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View`;
      viewBtn.onclick = () => openFlyout(configFile);
      btnGroup.appendChild(viewBtn);
    }

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action-btn copy-btn';
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    copyBtn.onclick = () => copyCode(block, copyBtn);
    btnGroup.appendChild(copyBtn);

    pre.appendChild(btnGroup);
  });

  // Make localhost URLs in <code> clickable
  contentEl.querySelectorAll('code').forEach(el => {
    if (el.closest('pre')) return; // skip code blocks
    const text = el.textContent;
    if (/^https?:\/\/localhost[:/]/.test(text)) {
      const link = document.createElement('a');
      link.href = text;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = text;
      link.className = 'localhost-link';
      el.replaceWith(link);
    }
  });

  contentEl.scrollTop = 0;
  updateNav(index);
  localStorage.setItem('workshop-step', index);
}

function copyCode(block, btn) {
  navigator.clipboard.writeText(block.textContent).then(() => {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
      btn.classList.remove('copied');
    }, 2000);
  });
}

// ---- Navigation ----
function updateNav(index) {
  document.getElementById('btn-prev').disabled = index <= 0;
  document.getElementById('btn-next').disabled = index >= steps.length - 1;
  document.getElementById('step-current').textContent = index + 1;
  document.getElementById('step-total').textContent = steps.length;

  const pct = ((index) / (steps.length - 1) * 100).toFixed(1);
  const progressEl = document.getElementById('progress-fill');
  if (progressEl) progressEl.style.width = `${pct}%`;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.step) < index) item.classList.add('completed');
  });

  const currentNavItem = document.querySelector(`.nav-item[data-step="${index}"]`);
  if (currentNavItem) {
    currentNavItem.classList.add('active');
    currentNavItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function buildSidebar() {
  const navList = document.getElementById('nav-list');
  let lastSectionId = null;

  steps.forEach((step, i) => {
    if (step.sectionId !== lastSectionId) {
      if (step.type !== 'welcome') {
        const label = document.createElement('li');
        label.className = 'nav-section-label';
        label.textContent = step.sectionLabel;
        navList.appendChild(label);
      }
      lastSectionId = step.sectionId;
    }

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.dataset.step = i;

    const iconSvg = step.type === 'welcome'
      ? `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`
      : step.type === 'theory'
        ? `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`
        : `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

    let title = step.title;
    if (title.length > 35) title = title.substring(0, 32) + '...';

    li.innerHTML = `<a onclick="goToStep(${i})">${iconSvg}<span>${title}</span></a>`;
    navList.appendChild(li);
  });
}

function goToStep(index) {
  if (index < 0 || index >= steps.length) return;
  currentStep = index;
  renderStep(index);
}

function nextStep() { if (currentStep < steps.length - 1) goToStep(currentStep + 1); }
function prevStep() { if (currentStep > 0) goToStep(currentStep - 1); }

// ---- Services Health Check ----
async function checkServices() {
  const dotEl = document.getElementById('status-dot');
  const textEl = document.getElementById('status-text');
  const listEl = document.getElementById('status-tooltip-list');

  // Checking state
  dotEl.className = 'status-dot checking';
  textEl.textContent = 'Проверка...';
  listEl.innerHTML = Object.entries(SERVICE_NAMES).map(([id, name]) =>
    `<div class="status-tooltip-item"><span class="svc-name">${name}</span><span class="svc-dot checking"></span></div>`
  ).join('');

  try {
    const data = await fetchJSON('/api/health');
    const errorCount = Object.values(data).filter(s => s.status !== 'ok').length;

    // Update main indicator
    if (errorCount === 0) {
      dotEl.className = 'status-dot ok';
      textEl.textContent = 'All services running';
    } else if (errorCount === 1) {
      dotEl.className = 'status-dot warn';
      textEl.textContent = '1 сервис недоступен';
    } else {
      dotEl.className = 'status-dot error';
      textEl.textContent = `${errorCount} сервисов недоступно`;
    }

    // Update tooltip list
    listEl.innerHTML = Object.entries(SERVICE_NAMES).map(([id, name]) => {
      const svc = data[id] || { status: 'error' };
      return `<div class="status-tooltip-item"><span class="svc-name">${name}</span><span class="svc-dot ${svc.status}"></span></div>`;
    }).join('');
  } catch {
    dotEl.className = 'status-dot error';
    textEl.textContent = 'Сервисы недоступны';
    listEl.innerHTML = Object.entries(SERVICE_NAMES).map(([id, name]) =>
      `<div class="status-tooltip-item"><span class="svc-name">${name}</span><span class="svc-dot error"></span></div>`
    ).join('');
  }
}

// ---- Config file mapping per section ----
const SECTION_CONFIG_FILES = {
  'collector': 'content/configs/otel-collector/config-step1.yaml',
  'victoriametrics': 'content/configs/otel-collector/config-step2.yaml',
  'victorialogs': 'content/configs/otel-collector/config-step3.yaml',
  'visualization': 'content/configs/otel-collector/config-step3.yaml',
};

// Config-related keywords to detect YAML config snippets
const CONFIG_KEYWORDS = ['receivers:', 'exporters:', 'processors:', 'service:', 'postgrespro:', 'hostmetrics:', 'pipelines:', 'plugins:'];

function isConfigBlock(codeText) {
  return CONFIG_KEYWORDS.some(kw => codeText.includes(kw));
}

// ---- Runnable Command Detection ----
// Maps curl patterns in code blocks to API endpoints
const CURL_COMMAND_MAP = [
  {
    pattern: /curl.*localhost:8889\/metrics.*grep.*"\^postgresql_".*head/,
    api: '/api/run/collector-metrics?filter=postgresql_&limit=10',
    label: 'PostgreSQL metrics (first 10)'
  },
  {
    pattern: /curl.*localhost:8889\/metrics.*grep.*-c.*"\^postgresql_"/,
    api: '/api/run/collector-metrics-count?filter=postgresql_',
    label: 'PostgreSQL metrics count'
  },
  {
    pattern: /curl.*localhost:8889\/metrics.*grep.*"\^system_".*head/,
    api: '/api/run/collector-metrics?filter=system_&limit=5',
    label: 'System metrics (first 5)'
  },
  {
    pattern: /curl.*localhost:8428\/api\/v1\/label/,
    api: '/api/run/vm-query?q=up',
    label: 'VictoriaMetrics metric names'
  },
  {
    pattern: /curl.*localhost:8428\/api\/v1\/query\?query=([^'"&\s]+)/,
    apiFn: (match) => `/api/run/vm-query?q=${encodeURIComponent(match[1])}`,
    label: 'VictoriaMetrics query'
  },
  {
    pattern: /curl.*localhost:9428\/select\/logsql\/query/,
    api: '/api/run/vl-query?q=*&limit=5',
    label: 'VictoriaLogs query'
  },
  {
    pattern: /curl.*localhost:8428\/health/,
    api: '/api/run/vm-query?q=up',
    label: 'VictoriaMetrics health'
  },
  {
    pattern: /curl.*localhost:9428\/health/,
    api: '/api/run/vl-query?q=*&limit=1',
    label: 'VictoriaLogs health'
  },
  {
    pattern: /curl.*localhost:3000\/api\/datasources/,
    apiFn: () => '/api/health',
    label: 'Grafana datasources'
  },
];

function findRunnableCommand(codeText) {
  for (const mapping of CURL_COMMAND_MAP) {
    const match = codeText.match(mapping.pattern);
    if (match) {
      const api = mapping.apiFn ? mapping.apiFn(match) : mapping.api;
      return { api, label: mapping.label };
    }
  }
  return null;
}

// ---- Run Command (execute check via API, show in bottom drawer) ----
async function runCommand(apiUrl, label) {
  const overlay = document.getElementById('drawer-overlay');
  const title = document.getElementById('drawer-title');
  const body = document.getElementById('drawer-body');

  title.textContent = label;
  body.innerHTML = '<div class="loading">Выполнение</div>';
  overlay.classList.add('open');

  try {
    const resp = await fetch(apiUrl);
    const data = await resp.json();

    if (data.ok === false) {
      body.innerHTML = `<pre><code class="run-error">Error: ${data.error}</code></pre>`;
      return;
    }

    const output = data.output || JSON.stringify(data, null, 2);
    let highlighted;
    if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
      highlighted = hljs.highlight(output, { language: 'json' }).value;
    } else {
      highlighted = escapeHtml(output);
    }

    const meta = [];
    if (data.total !== undefined) meta.push(`total: ${data.total}`);
    if (data.showing !== undefined) meta.push(`showing: ${data.showing}`);
    if (data.count !== undefined) meta.push(`count: ${data.count}`);
    const metaLine = meta.length ? `<div class="run-meta">${meta.join(' | ')}</div>` : '';

    body.innerHTML = `${metaLine}<pre><code>${highlighted}</code></pre>`;
  } catch (err) {
    body.innerHTML = `<pre><code class="run-error">Error: ${err.message}</code></pre>`;
  }
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- Flyout File Viewer ----
async function openFlyout(filePath) {
  const overlay = document.getElementById('flyout-overlay');
  const title = document.getElementById('flyout-title');
  const body = document.getElementById('flyout-body');

  // Extract filename for title
  const filename = filePath.split('/').pop();
  title.textContent = filename;

  // Show loading
  body.innerHTML = '<div class="loading">Загрузка</div>';
  overlay.classList.add('open');

  try {
    const text = await fetchText(filePath);
    // Detect language from extension
    const ext = filename.split('.').pop();
    const langMap = { yaml: 'yaml', yml: 'yaml', json: 'json', conf: 'ini', sh: 'bash' };
    const lang = langMap[ext] || '';

    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(text, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }

    body.innerHTML = `<pre><code class="language-${lang}">${highlighted}</code></pre>`;
  } catch (err) {
    body.innerHTML = `<div style="padding:1rem;color:var(--error);">Не удалось загрузить файл: ${err.message}</div>`;
  }
}

function closeFlyout() {
  document.getElementById('flyout-overlay').classList.remove('open');
}

// ---- Events ----
function initEvents() {
  document.getElementById('btn-prev').addEventListener('click', prevStep);
  document.getElementById('btn-next').addEventListener('click', nextStep);

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // Close flyout/drawer on Escape
    if (e.key === 'Escape') { closeFlyout(); closeDrawer(); return; }
    // Don't navigate when flyout/drawer is open
    if (document.getElementById('flyout-overlay').classList.contains('open')) return;
    if (document.getElementById('drawer-overlay').classList.contains('open')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextStep(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevStep(); }
    else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') { e.preventDefault(); toggleSidebar(); }
  });

  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const collapsed = !sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed', collapsed);

  // Toggle arrow direction
  const arrow = sidebar.querySelector('.sidebar-toggle svg');
  if (arrow) arrow.style.transform = collapsed ? 'rotate(180deg)' : '';

  // Show/hide expand button
  let expandBtn = document.getElementById('sidebar-expand');
  if (collapsed) {
    if (!expandBtn) {
      expandBtn = document.createElement('button');
      expandBtn.id = 'sidebar-expand';
      expandBtn.className = 'sidebar-expand-btn';
      expandBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
      expandBtn.onclick = toggleSidebar;
      document.getElementById('main').appendChild(expandBtn);
    }
    expandBtn.style.display = 'flex';
  } else {
    if (expandBtn) expandBtn.style.display = 'none';
  }
}

// ---- Init ----
async function init() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="loading">Загрузка контента</div>';

  const savedMode = localStorage.getItem('workshop-mode');
  if (savedMode) contentMode = savedMode;
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === contentMode);
  });

  initEvents();

  try {
    await loadAllContent();
    buildSidebar();

    const saved = localStorage.getItem('workshop-step');
    const startStep = saved ? Math.min(parseInt(saved), steps.length - 1) : 0;
    goToStep(startStep);

    // Check services in background
    checkServices();
  } catch (err) {
    contentEl.innerHTML = `
      <div class="content-inner">
        <h1>Ошибка загрузки</h1>
        <p>Не удалось загрузить контент: ${err.message}</p>
      </div>`;
    console.error(err);
  }
}

init();
