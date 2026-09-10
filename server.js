const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'students.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readStudents() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeStudents(students) {
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(students, null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
}

function cleanStudent(input) {
  return {
    id: String(input.id || '').trim(),
    name: String(input.name || '').trim(),
    age: Number(input.age),
    gender: String(input.gender || '').trim(),
    course: String(input.course || '').trim(),
    year: Number(input.year),
    section: String(input.section || '').trim().toUpperCase(),
    email: String(input.email || '').trim().toLowerCase(),
    phone: String(input.phone || '').trim(),
    city: String(input.city || '').trim(),
    attendance: Number(input.attendance),
    status: String(input.status || 'Active').trim()
  };
}

function validateStudent(s) {
  const errors = [];
  if (!s.id) errors.push('Student ID is required.');
  if (!s.name) errors.push('Name is required.');
  if (!Number.isInteger(s.age) || s.age < 10 || s.age > 100) errors.push('Age must be a whole number between 10 and 100.');
  if (!s.course) errors.push('Course is required.');
  if (!Number.isInteger(s.year) || s.year < 1 || s.year > 8) errors.push('Year must be between 1 and 8.');
  if (s.email && !/^\S+@\S+\.\S+$/.test(s.email)) errors.push('Enter a valid email address.');
  if (!Number.isFinite(s.attendance) || s.attendance < 0 || s.attendance > 100) errors.push('Attendance must be between 0 and 100.');
  if (s.status && !['Active', 'Inactive', 'Graduated', 'Suspended'].includes(s.status)) errors.push('Invalid status.');
  return errors;
}

app.get('/api/students', (req, res) => {
  const students = readStudents().sort((a, b) => a.name.localeCompare(b.name));
  res.json(students);
});

app.post('/api/students', (req, res) => {
  const student = cleanStudent(req.body);
  const errors = validateStudent(student);
  if (errors.length) return res.status(400).json({ errors });

  const students = readStudents();
  if (students.some(s => s.id.toLowerCase() === student.id.toLowerCase())) {
    return res.status(409).json({ errors: ['Student ID already exists.'] });
  }

  const now = new Date().toISOString();
  const saved = { ...student, createdAt: now, updatedAt: now };
  students.push(saved);
  writeStudents(students);
  res.status(201).json(saved);
});

app.put('/api/students/:id', (req, res) => {
  const students = readStudents();
  const index = students.findIndex(s => s.id.toLowerCase() === req.params.id.toLowerCase());
  if (index === -1) return res.status(404).json({ errors: ['Student not found.'] });

  const next = cleanStudent(req.body);
  const errors = validateStudent(next);
  if (errors.length) return res.status(400).json({ errors });
  if (next.id.toLowerCase() !== req.params.id.toLowerCase() && students.some(s => s.id.toLowerCase() === next.id.toLowerCase())) {
    return res.status(409).json({ errors: ['New Student ID already exists.'] });
  }

  const updated = { ...students[index], ...next, updatedAt: new Date().toISOString() };
  students[index] = updated;
  writeStudents(students);
  res.json(updated);
});

app.delete('/api/students/:id', (req, res) => {
  const students = readStudents();
  const next = students.filter(s => s.id.toLowerCase() !== req.params.id.toLowerCase());
  if (next.length === students.length) return res.status(404).json({ errors: ['Student not found.'] });
  writeStudents(next);
  res.status(204).end();
});

app.post('/api/students/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  const remove = new Set(ids.map(id => id.toLowerCase()));
  const students = readStudents();
  const next = students.filter(s => !remove.has(s.id.toLowerCase()));
  writeStudents(next);
  res.json({ removed: students.length - next.length });
});

app.post('/api/students/import', (req, res) => {
  if (!Array.isArray(req.body.students)) return res.status(400).json({ errors: ['Invalid import payload.'] });
  const incoming = req.body.students.map(cleanStudent);
  const errors = [];
  incoming.forEach((s, i) => validateStudent(s).forEach(e => errors.push(`Row ${i + 2}: ${e}`)));
  if (errors.length) return res.status(400).json({ errors: errors.slice(0, 20) });

  const students = readStudents();
  const byId = new Map(students.map(s => [s.id.toLowerCase(), s]));
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  incoming.forEach(s => {
    const old = byId.get(s.id.toLowerCase());
    if (old) {
      byId.set(s.id.toLowerCase(), { ...old, ...s, updatedAt: now });
      updated++;
    } else {
      byId.set(s.id.toLowerCase(), { ...s, createdAt: now, updatedAt: now });
      added++;
    }
  });
  writeStudents([...byId.values()]);
  res.json({ added, updated, total: incoming.length });
});

app.get('/api/export/xlsx', (req, res) => {
  const students = readStudents();
  const rows = students.map(({ createdAt, updatedAt, ...s }) => ({
    'Student ID': s.id,
    'Name': s.name,
    'Age': s.age,
    'Gender': s.gender,
    'Course': s.course,
    'Year': s.year,
    'Section': s.section,
    'Email': s.email,
    'Phone': s.phone,
    'City': s.city,
    'Attendance %': s.attendance,
    'Status': s.status
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [14, 24, 8, 12, 18, 8, 10, 28, 18, 18, 15, 14].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="student-data.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
});

app.get('/api/export/csv', (req, res) => {
  const students = readStudents();
  const rows = students.map(({ createdAt, updatedAt, ...s }) => ({
    'Student ID': s.id,
    'Name': s.name,
    'Age': s.age,
    'Gender': s.gender,
    'Course': s.course,
    'Year': s.year,
    'Section': s.section,
    'Email': s.email,
    'Phone': s.phone,
    'City': s.city,
    'Attendance %': s.attendance,
    'Status': s.status
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  res.setHeader('Content-Disposition', 'attachment; filename="student-data.csv"');
  res.type('text/csv').send(csv);
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Student Sheet Manager running at http://localhost:${PORT}`);
});
