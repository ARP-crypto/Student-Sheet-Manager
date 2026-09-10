# Student Sheet Manager

A professional, GitHub-ready student data management website for CSE/engineering students. It combines a clean dashboard with a spreadsheet-style student register and a lightweight REST API.

## Features

- Add, edit and delete student records
- Persistent storage in a local JSON data file
- Search by student ID, name, email, course or city
- Filter by course and enrollment status
- Bulk-select and delete records
- Dashboard KPIs: total students, active students, average attendance and course count
- Attendance and course distribution charts
- Export the complete register as `.xlsx` or `.csv`
- Import `.xlsx`, `.xls` or `.csv` and upsert records by Student ID
- Responsive layout for desktop, tablet and mobile
- REST API suitable for connecting a future React/Flutter/mobile client
- No frontend build step required

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js + Express
- **Spreadsheet:** SheetJS (`xlsx`)
- **Storage:** JSON file (`data/students.json`)

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

For development with Node's watch mode:

```bash
npm run dev
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/students` | List all students |
| POST | `/api/students` | Create a student |
| PUT | `/api/students/:id` | Update a student |
| DELETE | `/api/students/:id` | Delete a student |
| POST | `/api/students/bulk-delete` | Delete multiple students |
| POST | `/api/students/import` | Import/upsert spreadsheet data |
| GET | `/api/export/xlsx` | Download Excel workbook |
| GET | `/api/export/csv` | Download CSV |

## Spreadsheet import format

Use these column headings in the first row:

`Student ID, Name, Age, Gender, Course, Year, Section, Email, Phone, City, Attendance %, Status`

Student ID is the unique key. Imports update existing records when the Student ID already exists and add new records otherwise.

## Sample data

Copy `data/students.example.json` to `data/students.json` to start with demo records:

```bash
cp data/students.example.json data/students.json
```

## Suggested GitHub presentation

This project is suitable for a CSE mini-project, portfolio repository, internship demonstration, or college lab project. For production deployment, replace the JSON store with PostgreSQL/MySQL and add authentication + role-based access.

## License

MIT
