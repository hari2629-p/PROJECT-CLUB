/* Attendance Manager
   Requires: xlsx (SheetJS) loaded as XLSX
*/

const clubs = ["ISTE ALCHEMY","IEDC CEAL","FOSS CEAL","IEEE SB CEAL"];
const clubSelect = document.getElementById('clubSelect');
const eventNameEl = document.getElementById('eventName');
const eventDateEl = document.getElementById('eventDate');
const createEventBtn = document.getElementById('createEventBtn');
const savedEventsSelect = document.getElementById('savedEvents');
const deleteEventBtn = document.getElementById('deleteEventBtn');

const fileInput = document.getElementById('fileInput');
const loadSampleBtn = document.getElementById('loadSampleBtn');

const markAllPresentBtn = document.getElementById('markAllPresent');
const markAllAbsentBtn = document.getElementById('markAllAbsent');
const exportExcelBtn = document.getElementById('exportExcel');
const exportCSVBtn = document.getElementById('exportCSV');
const exportJSONBtn = document.getElementById('exportJSON');

const tableContainer = document.getElementById('tableContainer');
const totalCountEl = document.getElementById('totalCount');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');

let currentEventKey = null;
let currentRoster = []; // array of objects with Present boolean
const STORAGE_KEY = 'college_club_attendance_v1';

// populate clubs select just in case
(function initClubs(){
  clubSelect.innerHTML = clubs.map(c => `<option>${c}</option>`).join('');
})();

function loadStorage(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return {};
  try { return JSON.parse(raw); } catch(e){ return {};}
}

function saveStorage(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function refreshSavedEvents(){
  const data = loadStorage();
  const keys = Object.keys(data).sort((a,b)=> (data[a].date||'').localeCompare(data[b].date||''));
  savedEventsSelect.innerHTML = '';
  keys.forEach(k=>{
    const ev = data[k];
    const label = `${ev.club} — ${ev.name || '(untitled)'} ${ev.date? ' — '+ev.date : ''}`;
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = label;
    savedEventsSelect.appendChild(opt);
  });
  if(keys.length) {
    savedEventsSelect.value = keys[0];
    openEvent(keys[0]);
  } else {
    currentEventKey = null;
    currentRoster = [];
    renderTable();
  }
}

function createEvent(){
  const club = clubSelect.value;
  const name = eventNameEl.value.trim() || 'Untitled Event';
  const date = eventDateEl.value || '';
  const data = loadStorage();
  const key = `ev_${Date.now()}`;
  data[key] = {club,name,date,roster:[]};
  saveStorage(data);
  refreshSavedEvents();
  // select newly created
  savedEventsSelect.value = key;
  openEvent(key);
  alert('Event created. Upload roster to add participants.');
}

function openEvent(key){
  const data = loadStorage();
  if(!data[key]) return;
  currentEventKey = key;
  const ev = data[key];
  clubSelect.value = ev.club || clubs[0];
  eventNameEl.value = ev.name || '';
  eventDateEl.value = ev.date || '';
  currentRoster = (ev.roster || []).slice();
  renderTable();
}

function deleteEvent(key){
  if(!key) return;
  const data = loadStorage();
  if(!data[key]) return;
  if(!confirm('Delete this event and its attendance?')) return;
  delete data[key];
  saveStorage(data);
  refreshSavedEvents();
}

createEventBtn.addEventListener('click', createEvent);
deleteEventBtn.addEventListener('click', ()=> {
  const key = savedEventsSelect.value;
  deleteEvent(key);
});

savedEventsSelect.addEventListener('change', ()=> {
  const key = savedEventsSelect.value;
  openEvent(key);
});

// file parsing
fileInput.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const data = await f.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  // convert to JSON; defval ensures empty cells preserved
  const json = XLSX.utils.sheet_to_json(worksheet, {defval: ""});
  if(!json || !json.length){
    alert('No rows found in the uploaded sheet.');
    return;
  }
  ingestRoster(json);
  e.target.value = ''; // reset file input
});

// sample JSON loader
loadSampleBtn.addEventListener('click', async ()=>{
  // sample_data.json is local file - but easiest: provide hardcoded sample fallback
  const sample = [
    {"Name":"Aishwarya N","Stream":"CSE","Year":"3","College":"College of Engineering Attingal","Food Preference":"Veg","Paid":"Yes","Member":"Yes","Phone":"9876543210"},
    {"Name":"Arjun K","Stream":"ECE","Year":"2","College":"College of Engineering Attingal","Food Preference":"Non-Veg","Paid":"No","Member":"No","Phone":"9123456780"},
    {"Name":"Neha P","Stream":"ME","Year":"4","College":"College of Engineering Attingal","Food Preference":"Veg","Paid":"Yes","Member":"Yes","Phone":"9988776655"}
  ];
  ingestRoster(sample);
});

// try to normalize column names to canonical keys
const CANDIDATE_KEYS = {
  name: ["name","full name","student name","participant","participant name"],
  stream: ["stream","branch","dept","department"],
  year: ["year","batch"],
  college: ["college","institution","institution name"],
  food: ["food","food preference","foodpref","preference"],
  paid: ["paid","payment","paid/unpaid","fee status"],
  member: ["member","membership","is member","club member","member?"],
  phone: ["phone","phone number","mobile","mobile no","contact"]
};

function findKeyForColumn(colName){
  const s = (colName||'').toString().trim().toLowerCase();
  for(const canonical in CANDIDATE_KEYS){
    for(const candidate of CANDIDATE_KEYS[canonical]){
      if(s === candidate) return canonical;
    }
  }
  // fuzzy: check contains words
  for(const canonical in CANDIDATE_KEYS){
    for(const candidate of CANDIDATE_KEYS[canonical]){
      if(s.includes(candidate)) return canonical;
    }
  }
  return null;
}

function ingestRoster(rows){
  // rows: array of objects (as read from sheet). We'll map columns.
  if(!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const mapping = {}; // header -> canonical
  headers.forEach(h=>{
    const k = findKeyForColumn(h) || h.toLowerCase().replace(/\s+/g,'_');
    mapping[h]=k;
  });

  // construct normalized roster objects
  const roster = rows.map((r,idx)=>{
    const obj = {};
    for(const h of Object.keys(r)){
      const key = mapping[h];
      obj[key] = r[h];
    }
    // set canonical fields (ensure property names exist)
    obj.name = obj.name || obj['Name'] || obj.fullname || obj['full name'] || ('Participant '+(idx+1));
    obj.stream = obj.stream || '';
    obj.year = obj.year || '';
    obj.college = obj.college || '';
    obj.food = obj.food || '';
    obj.paid = (obj.paid === undefined || obj.paid === '')? '' : obj.paid;
    obj.member = (typeof obj.member === 'boolean') ? (obj.member? 'Yes':'No') : (obj.member || '');
    obj.present = !!(obj.present) || false; // default absent
    // keep all original columns too
    obj.__original = {...r};
    return obj;
  });

  // store into current event
  if(!currentEventKey){
    // create a temporary unnamed event
    createEvent();
  }
  const data = loadStorage();
  if(!data[currentEventKey]){
    data[currentEventKey] = {club: clubSelect.value, name: eventNameEl.value, date: eventDateEl.value, roster: []};
  }
  data[currentEventKey].roster = roster;
  saveStorage(data);
  currentRoster = roster.slice();
  renderTable();
}

function renderTable(){
  // generate HTML table from currentRoster
  tableContainer.innerHTML = '';
  if(!currentRoster || !currentRoster.length){
    tableContainer.innerHTML = '<div style="padding:14px;color:var(--muted)">No roster loaded. Create event and upload Excel/CSV or load sample.</div>';
    updateCounters();
    return;
  }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  // collect all unique keys across roster to show columns
  const colSet = new Set();
  currentRoster.forEach(r=> {
    Object.keys(r.__original || {}).forEach(k=>colSet.add(k));
  });
  // prefer canonical columns first
  const canonicalOrder = ['name','stream','year','college','food','paid','member','phone'];
  const otherCols = Array.from(colSet).filter(c=>!canonicalOrder.map(x=>x.toLowerCase()).includes(c.toLowerCase()));
  const headers = [...canonicalOrder.filter(h=>currentRoster.some(r=> r[h] !== undefined && r[h] !== '')), ...otherCols];

  // final headers plus Present column
  const finalHeaders = headers.map(h => h.charAt(0).toUpperCase()+h.slice(1)).concat(['Present']);

  thead.innerHTML = `<tr>${finalHeaders.map(h=>`<th>${h}</th>`).join('')}</tr>`;
  table.appendChild(thead);

  currentRoster.forEach((row, idx)=>{
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.className = row.present ? 'present' : 'absent';
    const cells = [];
    headers.forEach(col=>{
      // show canonical field if exists else original
      let val = row[col] !== undefined ? row[col] : (row.__original && row.__original[col] !== undefined ? row.__original[col] : '');
      // sanitize
      if(val === null || val === undefined) val = '';
      cells.push(`<td>${escapeHtml(String(val))}</td>`);
    });

    // present checkbox cell
    const checked = row.present ? 'checked' : '';
    const presentCell = `<td><input data-idx="${idx}" type="checkbox" class="present-checkbox" ${checked} /></td>`;

    tr.innerHTML = cells.join('') + presentCell;
    // click row to toggle
    tr.addEventListener('click', (e)=>{
      // if click was the checkbox itself let checkbox handler deal with it
      if(e.target && e.target.classList && e.target.classList.contains('present-checkbox')) return;
      togglePresent(idx);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);

  // attach checkbox handlers
  document.querySelectorAll('.present-checkbox').forEach(cb=>{
    cb.addEventListener('change', (e)=>{
      const i = Number(cb.dataset.idx);
      setPresent(i, cb.checked);
    });
  });

  updateCounters();
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function togglePresent(index){
  const newVal = !currentRoster[index].present;
  setPresent(index, newVal);
}

function setPresent(index, value){
  currentRoster[index].present = !!value;
  // reflect in storage
  const data = loadStorage();
  if(currentEventKey && data[currentEventKey]){
    data[currentEventKey].roster = currentRoster;
    saveStorage(data);
  }
  renderTable(); // re-render reflects row class & counts
}

function updateCounters(){
  const total = currentRoster.length;
  const present = currentRoster.filter(r=>r.present).length;
  const absent = total - present;
  totalCountEl.textContent = total;
  presentCountEl.textContent = present;
  absentCountEl.textContent = absent;
}

// bulk actions
markAllPresentBtn.addEventListener('click', ()=>{
  currentRoster.forEach(r=> r.present = true);
  persistRoster();
  renderTable();
});
markAllAbsentBtn.addEventListener('click', ()=>{
  currentRoster.forEach(r=> r.present = false);
  persistRoster();
  renderTable();
});

function persistRoster(){
  const data = loadStorage();
  if(currentEventKey && data[currentEventKey]){
    data[currentEventKey].roster = currentRoster;
    saveStorage(data);
  }
}

// exports
exportExcelBtn.addEventListener('click', ()=>{
  if(!currentRoster.length) return alert('No roster to export.');
  // convert to sheet data, include Present as Yes/No
  const out = currentRoster.map(r=>{
    // merge original columns and canonical fields
    const merged = {...(r.__original || {})};
    merged.Name = r.name || merged.Name;
    merged.Stream = r.stream || merged.Stream;
    merged.Year = r.year || merged.Year;
    merged.College = r.college || merged.College;
    merged['Food Preference'] = r.food || merged['Food Preference'];
    merged['Paid'] = r.paid || merged['Paid'];
    merged['Member'] = r.member || merged['Member'];
    merged['Present'] = r.present ? 'Yes' : 'No';
    return merged;
  });
  const ws = XLSX.utils.json_to_sheet(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const ev = loadStorage()[currentEventKey] || {};
  const filename = `${ev.club || 'Club'}_${ev.name || 'Event'}_${ev.date || ''}_attendance.xlsx`.replace(/\s+/g,'_');
  XLSX.writeFile(wb, filename);
});

exportCSVBtn.addEventListener('click', ()=>{
  if(!currentRoster.length) return alert('No roster to export.');
  const out = currentRoster.map(r=>{
    const merged = {...(r.__original || {})};
    merged.Name = r.name || merged.Name;
    merged.Stream = r.stream || merged.Stream;
    merged.Year = r.year || merged.Year;
    merged.College = r.college || merged.College;
    merged['Food Preference'] = r.food || merged['Food Preference'];
    merged['Paid'] = r.paid || merged['Paid'];
    merged['Member'] = r.member || merged['Member'];
    merged['Present'] = r.present ? 'Yes' : 'No';
    return merged;
  });
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(out));
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const ev = loadStorage()[currentEventKey] || {};
  const filename = `${ev.club || 'Club'}_${ev.name || 'Event'}_${ev.date || ''}_attendance.csv`.replace(/\s+/g,'_');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
});

exportJSONBtn.addEventListener('click', ()=>{
  if(!currentRoster.length) return alert('No roster to export.');
  const out = currentRoster.map(r=>{
    const merged = {...(r.__original || {})};
    merged.name = r.name || merged.name;
    merged.stream = r.stream || merged.stream;
    merged.year = r.year || merged.year;
    merged.college = r.college || merged.college;
    merged.food = r.food || merged.food;
    merged.paid = r.paid || merged.paid;
    merged.member = r.member || merged.member;
    merged.present = r.present || false;
    return merged;
  });
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
  const ev = loadStorage()[currentEventKey] || {};
  const filename = `${ev.club || 'Club'}_${ev.name || 'Event'}_${ev.date || ''}_attendance.json`.replace(/\s+/g,'_');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
});

// initial load
refreshSavedEvents();
