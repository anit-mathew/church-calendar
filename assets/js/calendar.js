const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTsF_4-QMue4gC-b8i13mBH_7uFpLjmvK6Zs0-jS1mJcR6V-_EN-mz-WF44x8xlqP_XzZgoOx_y9JE6/pub?gid=1852846165&single=true&output=csv";

let events = [];
let currentDate = new Date();
let selectedDateStr = null;
let fullMonthOn = false;

/* ── Utilities ── */
const pad = n => String(n).padStart(2, '0');
const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

function parseLocalDate(str) {
  const d = new Date(str);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function normalizeDate(str) {
  const d = parseLocalDate(str);
  return d ? toYMD(d) : null;
}

function isPublic(ev) {
  return (!ev.VISIBILITY || ev.VISIBILITY.toLowerCase().includes('public')) && ev.PROGRAM.trim() !== '';
}

/* ── CSV Load & Parse ── */
async function loadCsvAndParse() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();

    Papa.parse(text, {
      skipEmptyLines: true,
      complete: ({ data }) => {
        let headerIdx = data.findIndex(r => r.some(c => (c||'').toUpperCase().includes('DATE')));
        if (headerIdx < 0) headerIdx = 0;

        const headers = data[headerIdx].map(h => (h||'').trim().toUpperCase());
        const rows = data.slice(headerIdx + 1);
        events = [];

        rows.forEach(row => {
          const obj = {};
          headers.forEach((h, i) => obj[h] = (row[i]||'').trim());

          const parsedDate = normalizeDate(obj['DATE']);
          if (!parsedDate) return;

          const split = key => obj[key] ? obj[key].split('|') : [''];
          const programs     = split('PROGRAM');
          const locations    = split('LOCATION');
          const contacts     = split('CONTACT');
          const comments     = split('COMMENTS');
          const visibilities = split('VISIBILITY');

          const len = Math.max(programs.length, locations.length, contacts.length, comments.length, visibilities.length);

          for (let i = 0; i < len; i++) {
            events.push({
              parsedDate,
              PROGRAM:    programs[i]     || '',
              LOCATION:   locations[i]    || '',
              CONTACT:    contacts[i]     || '',
              COMMENTS:   comments[i]     || '',
              VISIBILITY: visibilities[i] || 'Public',
            });
          }
        });

        renderCalendar();
      }
    });
  } catch (e) {
    console.error('CSV load error:', e);
  }
}

/* ── Calendar Render ── */
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const firstDay  = new Date(y, m, 1).getDay();
  const totalDays = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day disabled';
    grid.appendChild(el);
  }

  for (let d = 1; d <= totalDays; d++) {
    const ymd = toYMD(new Date(y, m, d));
    const dayEl = document.createElement('div');
    dayEl.className = 'day';

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    dayEl.appendChild(num);

    const hasEvents = events.some(ev => ev.parsedDate === ymd && isPublic(ev));
    if (hasEvents) {
      dayEl.classList.add('has-events');
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      dayEl.appendChild(dot);
    }

    if (selectedDateStr === ymd) dayEl.classList.add('selected');

    dayEl.onclick = () => {
      selectedDateStr = ymd;
      document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
      dayEl.classList.add('selected');
      if (fullMonthOn) {
        fullMonthOn = false;
        document.getElementById('fullMonthBtn').textContent = 'Month View';
      }
      populatePanelForDate(ymd);
    };

    grid.appendChild(dayEl);
  }
}

/* ── Day Events Panel ── */
function populatePanelForDate(ymd) {
  const [y, mo, d] = ymd.split('-');
  document.getElementById('panelDate').textContent =
    new Date(+y, +mo - 1, +d).toLocaleString('default', { day: 'numeric', month: 'long', year: 'numeric' });

  renderEventList(events.filter(ev => ev.parsedDate === ymd && isPublic(ev)));
}

/* ── Month Events Panel ── */
function showFullMonthEvents() {
  const y = currentDate.getFullYear();
  const monthStr = `${y}-${pad(currentDate.getMonth() + 1)}`;

  document.getElementById('panelDate').textContent =
    `${currentDate.toLocaleString('default', { month: 'long' })} ${y} — All Events`;

  renderEventList(events.filter(ev => ev.parsedDate.startsWith(monthStr) && isPublic(ev)), true);
}

/* ── Render Event List ── */
function renderEventList(list, showDate = false) {
  const panelList = document.getElementById('panelList');

  if (list.length === 0) {
    panelList.innerHTML = `<div class="no-events">No public events found.</div>`;
    return;
  }

  panelList.innerHTML = '';

  list.forEach((ev, idx) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.style.animationDelay = `${idx * 0.05}s`;

    const icon = document.createElement('div');
    icon.className = 'event-icon';
    icon.textContent = ev.PROGRAM.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();

    const body = document.createElement('div');
    body.className = 'event-body';

    const title = document.createElement('div');
    title.className = 'event-title';

    if (showDate) {
      const [y, mo, d] = ev.parsedDate.split('-');
      const label = new Date(+y, +mo - 1, +d).toLocaleString('default', { month: 'short', day: 'numeric' });
      title.textContent = `${label} – ${ev.PROGRAM}`;
    } else {
      title.textContent = ev.PROGRAM;
    }

    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.innerHTML =
      (ev.LOCATION ? `📍 ${escapeHtml(ev.LOCATION)}<br>` : '') +
      (ev.CONTACT  ? `☎ ${escapeHtml(ev.CONTACT)}<br>`   : '') +
      (ev.COMMENTS ? `💬 <span>${escapeHtml(ev.COMMENTS)}</span>` : '');

    body.appendChild(title);
    body.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(body);
    panelList.appendChild(item);
  });
}

/* ── Month/Year Selectors ── */
function initMonthYearSelectors() {
  const monthSel = document.getElementById('monthSelect');
  const yearSel  = document.getElementById('yearSelect');
  monthSel.innerHTML = '';
  yearSel.innerHTML  = '';

  ['January','February','March','April','May','June',
   'July','August','September','October','November','December']
    .forEach((name, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = name;
      monthSel.appendChild(o);
    });

  const yr = currentDate.getFullYear();
  for (let y = yr - 5; y <= yr + 20; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    yearSel.appendChild(o);
  }

  monthSel.value = currentDate.getMonth();
  yearSel.value  = currentDate.getFullYear();

  monthSel.onchange = () => { currentDate.setMonth(+monthSel.value); renderCalendar(); };
  yearSel.onchange  = () => { currentDate.setFullYear(+yearSel.value); renderCalendar(); };
}

/* ── Nav Buttons ── */
document.getElementById('prevMonthBtn').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  initMonthYearSelectors();
  renderCalendar();
  if (fullMonthOn) showFullMonthEvents();
};

document.getElementById('nextMonthBtn').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  initMonthYearSelectors();
  renderCalendar();
  if (fullMonthOn) showFullMonthEvents();
};

/* ── Toggle Button ── */
document.getElementById('fullMonthBtn').onclick = () => {
  fullMonthOn = !fullMonthOn;
  const btn = document.getElementById('fullMonthBtn');
  if (fullMonthOn) {
    btn.textContent = 'Day View';
    showFullMonthEvents();
  } else {
    btn.textContent = 'Month View';
    if (selectedDateStr) {
      populatePanelForDate(selectedDateStr);
    } else {
      document.getElementById('panelList').innerHTML = `<div class="no-events">← Tap a day to see events</div>`;
      document.getElementById('panelDate').textContent = 'Select a date';
    }
  }
};

/* ── Init ── */
initMonthYearSelectors();
renderCalendar();
loadCsvAndParse();
