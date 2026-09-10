const state = { students: [], filtered: [], editingId: null, selected: new Set() };
const $ = s => document.querySelector(s);
const els = {
  tableBody: $('#tableBody'), empty: $('#emptyState'), search: $('#searchInput'), course: $('#courseFilter'), status: $('#statusFilter'),
  selectAll: $('#selectAll'), bulkBar: $('#bulkBar'), selectedCount: $('#selectedCount'), modal: $('#modal'), modalTitle: $('#modalTitle'), form: $('#studentForm'), formError: $('#formError'), toast: $('#toast')
};

async function api(url, options={}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch {}
    throw new Error((body.errors || ['Request failed.']).join(' '));
  }
  return res.status === 204 ? null : res.json();
}

function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function showToast(msg) { els.toast.textContent = msg; els.toast.classList.remove('hidden'); setTimeout(() => els.toast.classList.add('hidden'), 2200); }
function openModal(student=null) {
  state.editingId = student?.id || null;
  els.modalTitle.textContent = student ? 'Edit Student' : 'Add Student';
  els.form.reset();
  els.formError.classList.add('hidden');
  if (student) for (const [k,v] of Object.entries(student)) if (els.form.elements[k]) els.form.elements[k].value = v ?? '';
  els.modal.classList.remove('hidden'); els.modal.setAttribute('aria-hidden','false');
}
function closeModal() { els.modal.classList.add('hidden'); els.modal.setAttribute('aria-hidden','true'); }
function setStats() {
  const s = state.students;
  $('#totalCount').textContent = s.length;
  $('#activeCount').textContent = s.filter(x => x.status === 'Active').length;
  $('#attendanceAvg').textContent = s.length ? `${(s.reduce((a,x)=>a+Number(x.attendance||0),0)/s.length).toFixed(1)}%` : '0%';
  $('#courseCount').textContent = new Set(s.map(x=>x.course).filter(Boolean)).size;
  renderCharts();
}
function refreshFilters() {
  const current = els.course.value; const courses = [...new Set(state.students.map(s=>s.course).filter(Boolean))].sort();
  els.course.innerHTML = '<option value="">All courses</option>' + courses.map(c => `<option>${escapeHtml(c)}</option>`).join('');
  els.course.value = courses.includes(current) ? current : '';
}
function applyFilters() {
  const q = els.search.value.toLowerCase().trim(), c = els.course.value, st = els.status.value;
  state.filtered = state.students.filter(s => {
    const blob = `${s.id} ${s.name} ${s.email} ${s.course} ${s.city}`.toLowerCase();
    return (!q || blob.includes(q)) && (!c || s.course === c) && (!st || s.status === st);
  });
  renderTable();
}
function renderTable() {
  els.tableBody.innerHTML = state.filtered.map(s => `<tr>
    <td class="check-col"><input type="checkbox" class="row-check" data-id="${escapeHtml(s.id)}" ${state.selected.has(s.id)?'checked':''}></td>
    <td><strong>${escapeHtml(s.id)}</strong></td>
    <td><div class="student-name">${escapeHtml(s.name)}</div><div class="student-meta">${escapeHtml(s.city || '')}</div></td>
    <td>${s.age}</td><td>${escapeHtml(s.course)}</td><td>${s.year}</td><td>${escapeHtml(s.section || '—')}</td>
    <td>${escapeHtml(s.email || '—')}</td><td class="attendance">${Number(s.attendance).toFixed(1)}%</td>
    <td><span class="status ${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
    <td><div class="action-group"><button class="small-btn" data-edit="${escapeHtml(s.id)}">Edit</button><button class="small-btn" data-delete="${escapeHtml(s.id)}">Delete</button></div></td>
  </tr>`).join('');
  els.empty.classList.toggle('hidden', state.filtered.length !== 0);
  updateBulkState();
}
function updateBulkState() { els.selectedCount.textContent = state.selected.size; els.bulkBar.classList.toggle('hidden', state.selected.size === 0); els.selectAll.checked = state.filtered.length > 0 && state.filtered.every(s=>state.selected.has(s.id)); }
function renderCharts() {
  const attendanceBands = [['90–100', s=>s.attendance>=90],['75–89',s=>s.attendance>=75&&s.attendance<90],['60–74',s=>s.attendance>=60&&s.attendance<75],['Below 60',s=>s.attendance<60]];
  const counts = attendanceBands.map(([label,fn])=>({label,count:state.students.filter(fn).length})); const max = Math.max(1,...counts.map(x=>x.count));
  $('#attendanceBars').innerHTML = counts.map(x=>`<div class="bar-row"><span>${x.label}</span><div class="bar-track"><div class="bar-fill" style="width:${x.count/max*100}%"></div></div><strong>${x.count}</strong></div>`).join('');
  const courses = Object.entries(state.students.reduce((a,s)=>(a[s.course]=(a[s.course]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]).slice(0,6); const maxC=Math.max(1,...courses.map(x=>x[1]));
  $('#courseBars').innerHTML = courses.length ? courses.map(([label,count])=>`<div class="bar-row"><span title="${escapeHtml(label)}">${escapeHtml(label.slice(0,15))}</span><div class="bar-track"><div class="bar-fill" style="width:${count/maxC*100}%"></div></div><strong>${count}</strong></div>`).join('') : '<p class="muted">No course data yet.</p>';
}
async function load() { state.students = await api('/api/students'); refreshFilters(); setStats(); applyFilters(); }

$('#addBtn').onclick=()=>openModal(); $('#closeModal').onclick=closeModal; $('#cancelBtn').onclick=closeModal;
els.modal.onclick=e=>{ if(e.target===els.modal) closeModal(); };
els.search.oninput=applyFilters; els.course.onchange=applyFilters; els.status.onchange=applyFilters;
$('#clearFiltersBtn').onclick=()=>{els.search.value='';els.course.value='';els.status.value='';applyFilters();};

els.form.onsubmit=async e=>{
  e.preventDefault(); els.formError.classList.add('hidden');
  const data = Object.fromEntries(new FormData(els.form).entries()); ['age','year','attendance'].forEach(k=>data[k]=Number(data[k]));
  try { await api(state.editingId ? `/api/students/${encodeURIComponent(state.editingId)}` : '/api/students', {method: state.editingId?'PUT':'POST', body: JSON.stringify(data)}); closeModal(); await load(); showToast(state.editingId?'Student updated':'Student added'); }
  catch(err){ els.formError.textContent=err.message; els.formError.classList.remove('hidden'); }
};

els.tableBody.onclick=async e=>{
  const edit=e.target.closest('[data-edit]'), del=e.target.closest('[data-delete]');
  if(edit){ const s=state.students.find(x=>x.id===edit.dataset.edit); openModal(s); }
  if(del && confirm('Delete this student record?')){ try{await api(`/api/students/${encodeURIComponent(del.dataset.delete)}`,{method:'DELETE'});state.selected.delete(del.dataset.delete);await load();showToast('Student deleted');}catch(err){showToast(err.message);} }
};
els.tableBody.onchange=e=>{ if(e.target.classList.contains('row-check')){const id=e.target.dataset.id;e.target.checked?state.selected.add(id):state.selected.delete(id);updateBulkState();} };
els.selectAll.onchange=()=>{if(els.selectAll.checked)state.filtered.forEach(s=>state.selected.add(s.id));else state.filtered.forEach(s=>state.selected.delete(s.id));renderTable();};
$('#bulkDeleteBtn').onclick=async()=>{if(!state.selected.size||!confirm(`Delete ${state.selected.size} selected records?`))return;try{await api('/api/students/bulk-delete',{method:'POST',body:JSON.stringify({ids:[...state.selected]})});state.selected.clear();await load();showToast('Selected students deleted');}catch(err){showToast(err.message);}};
$('#exportXlsxBtn').onclick=()=>window.location='/api/export/xlsx'; $('#exportCsvBtn').onclick=()=>window.location='/api/export/csv';

$('#importBtn').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=async e=>{
  const file=e.target.files[0]; if(!file)return; 
  try {
    const ab=await file.arrayBuffer(); const wb=XLSX.read(ab,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    const keyMap={'Student ID':'id','Name':'name','Age':'age','Gender':'gender','Course':'course','Year':'year','Section':'section','Email':'email','Phone':'phone','City':'city','Attendance %':'attendance','Status':'status'};
    const students=rows.map(row=>{const out={};Object.entries(row).forEach(([k,v])=>{if(keyMap[k])out[keyMap[k]]=v});return out;});
    const result=await api('/api/students/import',{method:'POST',body:JSON.stringify({students})}); await load(); showToast(`Imported ${result.total} rows (${result.added} added, ${result.updated} updated)`);
  }catch(err){showToast(err.message||'Import failed');}finally{e.target.value='';}
};

load().catch(err=>showToast(err.message));
