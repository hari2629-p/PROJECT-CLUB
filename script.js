let currentRoster = [];

const tableContainer = document.getElementById("tableContainer");
const totalCountEl = document.getElementById("totalCount");
const presentCountEl = document.getElementById("presentCount");
const absentCountEl = document.getElementById("absentCount");

// Column mapping (normalize uploaded sheet headers)
const columnMap = {
  "department": "Stream",
  "branch": "Stream",
  "stream": "Stream",
  "yr": "Year",
  "year": "Year",
  "year of study": "Year",
  "batch": "Year",
  "college": "College",
  "institution": "College",
  "university": "College",
  "food": "Food",
  "food preference": "Food",
  "meal": "Food",
  "paid": "Paid",
  "fee paid": "Paid",
  "payment": "Paid",
  "member": "Member",
  "membership": "Member",
  "club member": "Member",
  "name": "Name",
  "full name": "Name",
  "participant name": "Name"
};

function normalizeHeaders(row) {
  let newRow = {};
  for (let key in row) {
    const normKey = key.toLowerCase().trim();
    if (columnMap[normKey]) {
      newRow[columnMap[normKey]] = row[key];
    } else {
      newRow[key] = row[key]; // keep unmapped
    }
  }
  return newRow;
}

function updateCounters() {
  const total = currentRoster.length;
  const present = currentRoster.filter(r => r.present).length;
  const absent = total - present;
  totalCountEl.textContent = total;
  presentCountEl.textContent = present;
  absentCountEl.textContent = absent;
}

function renderTable() {
  if (!currentRoster.length) {
    tableContainer.innerHTML = "<p>No roster uploaded.</p>";
    updateCounters();
    return;
  }

  // Always show these first
  const coreFields = ["Name", "Stream", "Year", "College", "Food", "Paid", "Member"];

  // Collect all keys
  const allKeys = new Set();
  currentRoster.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  allKeys.delete("present");

  const extraKeys = [...allKeys].filter(k => !coreFields.includes(k));
  const headers = [...coreFields, ...extraKeys];

  let html = "<table><thead><tr>";
  headers.forEach(h => html += `<th>${h}</th>`);
  html += "<th>Present</th></tr></thead><tbody>";

  currentRoster.forEach((row, idx) => {
    html += `<tr class="${row.present ? "present-row" : "absent-row"}">`;
    headers.forEach(h => html += `<td>${row[h] || ""}</td>`);
    html += `<td><input type="checkbox" data-idx="${idx}" ${row.present ? "checked" : ""}></td>`;
    html += "</tr>";
  });

  html += "</tbody></table>";
  tableContainer.innerHTML = html;

  document.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", e => {
      const i = e.target.dataset.idx;
      currentRoster[i].present = e.target.checked;
      renderTable();
    });
  });

  updateCounters();
}

// Handle file upload
document.getElementById("fileInput").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  const data = await f.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  currentRoster = json.map(r => ({ ...normalizeHeaders(r), present: false }));
  renderTable();
});

// Sample data
document.getElementById("loadSampleBtn").addEventListener("click", () => {
  currentRoster = [
    { Name: "Aishwarya N", Stream: "CSE", Year: "3", College: "CEAL", Food: "Veg", Paid: "Yes", Member: "Yes", present: false },
    { Name: "Arjun K", Stream: "ECE", Year: "2", College: "CEAL", Food: "Non-Veg", Paid: "No", Member: "No", present: false }
  ];
  renderTable();
});

// Export attendance
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!currentRoster.length) {
    alert("No data to export!");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(currentRoster);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, "attendance_result.xlsx");
});
