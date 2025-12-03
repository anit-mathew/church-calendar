const CSV_URL =
 "https://docs.google.com/spreadsheets/d/e/2PACX-1vTsF_4-QMue4gC-b8i13mBH_7uFpLjmvK6Zs0-jS1mJcR6V-_EN-mz-WF44x8xlqP_XzZgoOx_y9JE6/pub?gid=1852846165&single=true&output=csv";

let events = [];
let currentDate = new Date();
let selectedDateStr = null;

function pad(n){ return String(n).padStart(2,'0'); }
function toYMD(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function escapeHtml(s){
  if(!s) return '';
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function parseLocalDate(str){
  const d = new Date(str);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function normalizeDate(dateStr){
  if(!dateStr) return null;
  const d = parseLocalDate(dateStr);
  if(d) return toYMD(d);
  return null;
}

let fullMonthOn = false;

document.getElementById("fullMonthBtn").onclick = () => {
  fullMonthOn = !fullMonthOn;
  const btn = document.getElementById("fullMonthBtn");

  if (fullMonthOn) {
    btn.textContent = "Day View";
    showFullMonthEvents();
  } else {
    btn.textContent = "Month View";
    if (selectedDateStr) {
      populatePanelForDate(selectedDateStr);
    } else {
      document.getElementById("panelList").innerHTML =
        `<div class="no-events">No events selected. Tap a day.</div>`;
      document.getElementById("panelDate").textContent = "Select a date";
    }
  }
};

async function loadCsvAndParse(){
  try{
    const res = await fetch(CSV_URL);
    const text = await res.text();

    Papa.parse(text, {
      skipEmptyLines:true,
      complete: result => {
        const data = result.data;

        let headerRowIndex = data.findIndex(r =>
          r.some(c => (c||"").toUpperCase().includes("DATE"))
        );

        if(headerRowIndex < 0) headerRowIndex = 0;

        const headers = data[headerRowIndex].map(h => (h||"").trim().toUpperCase());
        const rows = data.slice(headerRowIndex+1);

        events = [];

        rows.forEach(row=>{
          const obj = {};
          headers.forEach((h,i)=> obj[h] = (row[i]||"").trim() );

          const normalizedDate = normalizeDate(obj["DATE"]);

          if(normalizedDate){
            const programs = obj.PROGRAM ? obj.PROGRAM.split("|") : [''];
            const locations = obj.LOCATION ? obj.LOCATION.split("|") : [''];
            const contacts = obj.CONTACT ? obj.CONTACT.split("|") : [''];
            const comments = obj.COMMENTS ? obj.COMMENTS.split("|") : [''];
            const visibilities = obj.VISIBILITY ? obj.VISIBILITY.split("|") : [''];

            const maxLen = Math.max(programs.length, locations.length, contacts.length, comments.length, visibilities.length);

            for(let i=0;i<maxLen;i++){
              events.push({
                parsedDate: normalizedDate,
                PROGRAM: programs[i] || '',
                LOCATION: locations[i] || '',
                CONTACT: contacts[i] || '',
                COMMENTS: comments[i] || '',
                VISIBILITY: visibilities[i] || 'Public'
              });
            }
          }
        });

        renderCalendar();
      }
    });

  } catch(e){
    console.error("CSV load error:", e);
  }
}

function renderCalendar(){
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const first = new Date(y, m, 1);

  const wd = first.getDay();  

  const total = new Date(y, m+1, 0).getDate();

  for(let i=0;i<wd;i++){
    const e = document.createElement("div");
    e.className="day disabled";
    grid.appendChild(e);
  }

  for(let d=1; d<=total; d++){
    const dt = new Date(y, m, d);
    const ymd = toYMD(dt);

    const dayEl = document.createElement("div");
    dayEl.className="day";
    dayEl.dataset.ymd = ymd;

    const dot = document.createElement("div");
    dot.className="dot";
    dot.textContent = d;
    dayEl.appendChild(dot);

    const dayEvents = events.filter(e =>
      e.parsedDate === ymd &&
      (!e.VISIBILITY || e.VISIBILITY.toLowerCase().includes("public")) &&
      e.PROGRAM.trim() !== ""
    );

    if(dayEvents.length > 0){
      const evDot = document.createElement("div");
      evDot.className="event-dot";
      dayEl.appendChild(evDot);
    }

    if(selectedDateStr === ymd) dayEl.classList.add("selected");

    dayEl.onclick = () => {
      selectedDateStr = ymd;
      populatePanelForDate(ymd);
      document.querySelectorAll(".day.selected").forEach(el=>el.classList.remove("selected"));
      dayEl.classList.add("selected");
    };

    grid.appendChild(dayEl);
  }
}

function populatePanelForDate(ymd){
  const panelDate = document.getElementById("panelDate");
  const panelList = document.getElementById("panelList");

  const parts = ymd.split("-");
  const d = new Date(parts[0], parts[1]-1, parts[2]);
  panelDate.textContent = d.toLocaleString("default",{day:"numeric",month:"long",year:"numeric"});

  const dayEvents = events.filter(e =>
    e.parsedDate === ymd &&
    (!e.VISIBILITY || e.VISIBILITY.toLowerCase().includes("public")) &&
    e.PROGRAM.trim() !== ""
  );

  if(dayEvents.length === 0){
    panelList.innerHTML = `<div class="no-events">No events planned for today</div>`;
    return;
  }

  panelList.innerHTML = "";

  dayEvents.forEach(ev=>{
    const item = document.createElement("div");
    item.className="event-item";

    const icon = document.createElement("div");
    icon.className="event-icon";
    icon.textContent = ev.PROGRAM.split(" ").map(x=>x[0]).join("").substring(0,2).toUpperCase();

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className="event-title";
    title.textContent = ev.PROGRAM;

    const meta = document.createElement("div");
    meta.innerHTML =
      (ev.LOCATION?`📍 ${escapeHtml(ev.LOCATION)}<br>`:"") +
      (ev.CONTACT?` ☎  ${escapeHtml(ev.CONTACT)}<br>`:"") +
      (ev.COMMENTS ? ` 💬 <span style="color:#9aa6b2;"> ${escapeHtml(ev.COMMENTS)}</span>` : "");

    body.appendChild(title);
    body.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(body);
    panelList.appendChild(item);
  });
}

function initMonthYearSelectors(){
  const monthSel = document.getElementById("monthSelect");
  const yearSel = document.getElementById("yearSelect");

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  months.forEach((m,i)=>{
    const o=document.createElement("option");
    o.value=i; o.textContent=m;
    monthSel.appendChild(o);
  });

  const yr = currentDate.getFullYear();
  for(let y=yr-5; y<=yr+20; y++){
    const o=document.createElement("option");
    o.value=y; o.textContent=y;
    yearSel.appendChild(o);
  }

  monthSel.value = currentDate.getMonth();
  yearSel.value = currentDate.getFullYear();

  monthSel.onchange = ()=>{
    currentDate.setMonth(parseInt(monthSel.value));
    renderCalendar();
  };

  yearSel.onchange = ()=>{
    currentDate.setFullYear(parseInt(yearSel.value));
    renderCalendar();
  };
}

document.getElementById("prevMonthBtn").onclick = ()=>{
  currentDate.setMonth(currentDate.getMonth()-1);
  initMonthYearSelectors();
  renderCalendar();
};

document.getElementById("nextMonthBtn").onclick = ()=>{
  currentDate.setMonth(currentDate.getMonth()+1);
  initMonthYearSelectors();
  renderCalendar();
};

function showFullMonthEvents() {
  const panelDate = document.getElementById("panelDate");
  const panelList = document.getElementById("panelList");

  const y = currentDate.getFullYear();
  const m = currentDate.getMonth() + 1;

  panelDate.textContent = 
    `All Public Events – ${currentDate.toLocaleString("default",{month:"long"})} ${y}`;

  const monthStr = `${y}-${String(m).padStart(2,"0")}`;

  const monthEvents = events.filter(ev =>
    ev.parsedDate.startsWith(monthStr) &&
    (!ev.VISIBILITY || ev.VISIBILITY.toLowerCase().includes("public")) &&
    ev.PROGRAM.trim() !== ""
  );

  if (monthEvents.length === 0) {
    panelList.innerHTML = `<div class="no-events">No public events for this month.</div>`;
    return;
  }

  panelList.innerHTML = "";

  monthEvents.forEach(ev => {
    const item = document.createElement("div");
    item.className = "event-item";

    const icon = document.createElement("div");
    icon.className = "event-icon";
    icon.textContent = ev.PROGRAM.split(" ").map(x=>x[0]).join("").substring(0,2).toUpperCase();

    const body = document.createElement("div");

    const title = document.createElement("div");
    title.className = "event-title";

    const parts = ev.parsedDate.split("-");
    const localDate = new Date(parts[0], parts[1]-1, parts[2]);
    const formattedDate = localDate.toLocaleString("default", {
      month: "short",
      day: "numeric"
    });

    title.textContent = `${formattedDate} – ${ev.PROGRAM}`;

    const meta = document.createElement("div");
    meta.innerHTML =
      (ev.LOCATION ? `📍 ${escapeHtml(ev.LOCATION)}<br>` : "") +
      (ev.CONTACT ? ` ☎ ${escapeHtml(ev.CONTACT)}<br>` : "") +
      (ev.COMMENTS ? ` 💬 <span style="color:#9aa6b2;">${escapeHtml(ev.COMMENTS)}</span>` : "");

    body.appendChild(title);
    body.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(body);

    panelList.appendChild(item);
  });
}

loadCsvAndParse();
initMonthYearSelectors();
renderCalendar();
