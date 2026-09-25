# School Management System

A web app for running a school: students, teachers, classes, subjects and, later, attendance, exams and fees.

Built with **Next.js 16** (App Router, Server Actions), **Prisma 7** with **PostgreSQL**, **Tailwind CSS 4** and **TypeScript**.

## Getting started (local)

```bash
npm install            # also generates the Prisma client
npm run db:local       # start a local Postgres (Prisma Dev); it prints a connection URL
cp .env.example .env   # set DATABASE_URL to that URL
npm run db:migrate     # create the tables
npm run db:seed        # add a demo school with classes, subjects, teachers and students
npm run dev
```

Open http://localhost:3000. It redirects to the Admin Portal. You can use a Neon database locally instead of Prisma Dev; see below.

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run db:local` | Start the local Postgres server (`prisma dev --name sms --detach`) |
| `npm run db:migrate` | Apply schema changes (`prisma migrate dev`) |
| `npm run db:seed` | Seed the demo school (skipped if a school already exists) |
| `npm run db:reset` | Wipe the database, re-apply migrations and re-seed |
| `npm run db:studio` | Browse the data in Prisma Studio |

## Deploying (Vercel + Neon)

1. Create a free project at [neon.tech](https://neon.tech) and copy two connection strings: the **pooled** one (host contains `-pooler`) and the **direct** one.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import this GitHub repo.
3. Under **Environment Variables**, add `DATABASE_URL` (the pooled string) and `DIRECT_URL` (the direct string).
4. Deploy. The `vercel-build` script runs `prisma migrate deploy`, seeds the demo school the first time, and builds the app.

> ⚠️ There is no login yet, so anyone with the URL can view and change all data. Use fake test data only.

## Admin Portal (step 1)

| Area | Features |
|---|---|
| **Students** | Add, edit and remove students: name (with optional middle name), blood group, Aadhaar, category, religion, caste, nationality, WhatsApp, primary and correspondence address, last school, and father's and mother's names. Each student gets a unique ID (`STU-<year>-0001`). Assign a class and section. The class's subjects are allotted automatically, and you can adjust each student's subjects. Search and filter by class. |
| **Teachers** | Add, edit and remove teachers. Each teacher gets a unique ID (`TCH-0001`). The teacher's page shows their class-teacher and subject-teacher roles. |
| **Classes** | Add classes with sections (A, B, …). Set the class curriculum, with an option to apply changes to students already in the class. Assign one **class teacher** per section (a teacher can be class teacher of only one section) and a **subject teacher** for each subject in each section. |
| **Subjects** | Add and delete subjects (name and code). |
| **Houses** | Create houses with any name and colour (e.g. Green House). Assign students one at a time from their profile, or in bulk from the house page. |
| **Sessions** | Academic years run April–March (e.g. 2026-27). At year end, click **Promote class** on each class: everyone moves up by default, and you mark anyone repeating, leaving or passing out. The next session is created automatically. Then **Start** it from the Sessions page. Each student's class history is kept. |
| **Bulk upload** | On the Students or Teachers list, click **Bulk upload**. Download the Excel template (with dropdowns for class, gender and blood group), fill in one row per person, and click **Check file** to see each row as ready or with its error. Then import. Up to 300 rows per file. |
| **Export & filters** | Search updates as you type (× clears it). Filters: class, section, house, gender, category and blood group for students; role, subject, gender and blood group for teachers. **Export** downloads an Excel file of the current list with the columns you choose. |
| **Roll numbers** | Unique within a section. Enter them by hand, or use **Auto-assign roll numbers** (A–Z from 1) or **Fill missing only** on the class page. They're renumbered A–Z automatically when a new session starts. |

**Passport photos** can be added for students and teachers from the add and edit forms. The browser crops each photo to 35 × 45 mm (350 × 450 px JPEG, about 30–60 KB) before uploading. The server only accepts real JPEG, PNG or WebP files up to 1 MB. Photos are stored in the `Photo` table and served from `/api/photos/<id>`.

**Documents** are on the **Documents** tab of each student and teacher profile. Admins can upload Aadhaar, PAN, birth and transfer certificates, marksheets, resumes, educational certificates, experience letters, address proof and other files: PDF, JPG, PNG, WebP, DOC or DOCX, up to 4 MB each. A checklist shows which key documents are missing. Aadhaar and PAN numbers are checked for the right format and shown masked. The server checks each file's actual contents, not only its name. Files are stored in the `DocumentFile` table and served from `/api/documents/<id>` with `Cache-Control: no-store`. The server action body limit is raised to 4.5 MB in `next.config.ts`, which matches Vercel's request size cap.

> ⚠️ These are sensitive personal records. Until login is added, anyone who can reach the app can open them. Don't deploy it anywhere public before authentication is in place.

**Removing** a student or teacher marks them inactive and does not delete them. This keeps their history (attendance, marks, fees later) and lets them be restored. A removed teacher loses their class-teacher and subject-teacher roles.

## Power Admin (multiple schools)

Power Admin at **`/power`** manages every school on the system:

- **Schools:** add, edit (name, code, board, principal, contact details, **logo**), suspend or reactivate.
- **Open Admin Portal:** switches the Admin Portal to that school. The sidebar shows its logo, plus a *Switch school* link when there are several schools.
- **Data tools:** download a full Excel backup, load demo data into an empty school, purge removed students and teachers, clean unused files, **reset** a school's data, or **delete** a school (both ask you to type the school code).
- **System:** database size, migrations, unused files, and an **activity log** of every Power Admin action (including failed sign-ins).

**Setup:** set `POWER_ADMIN_PASSWORD` (at least 10 characters) in the environment: in Vercel under *Settings → Environment Variables*, then redeploy, or in `.env` locally. Without it, Power Admin stays switched off. Sessions last 8 hours, and changing the password signs everyone out.

### School admins and sign-in

- **Accounts:** Power Admin creates school admin accounts, either while adding a school or later on the school's page under **School admins**. Each account has a name, email and password, and the password field has *Generate* and *Copy* buttons. From there you can also **reset a password**, **disable/enable** an account or delete it.
- **Signing in:** school admins sign in at **`/login`** and only ever see **their own school**. They can change their password under **Account & password**, which signs out their other devices.
- **What's protected:** the whole Admin Portal, including photos, documents, exports and templates, needs a signed-in school admin or Power Admin. Otherwise it redirects to `/login`. A Power Admin can open any school, and sees a "Viewing … as Power Admin" banner.
- **Security:** passwords are stored with scrypt (salted). Sessions are kept in the database and last 12 hours. They are revoked on sign-out, password reset, disabling an admin or suspending the school. Failed sign-ins are slowed down and recorded in the activity log.

## Teacher Portal

Teachers sign in at **`/login`** under the **Teacher** tab (or `/login?role=teacher`) and land on **`/teacher`**.

- **Creating a login:** when adding a teacher, *Create a login for this teacher* is ticked by default. After saving, the username (for example `dps.tch0001`) and a generated password are shown **once**, with copy buttons. For existing teachers, use the **Teacher login** card on the teacher's profile.
- **Admin controls (Teacher login card):** **reset password** (shows a new one), **change username**, **turn off / turn on**, and **remove login**. Each of these signs the teacher out everywhere.
- **What a teacher sees:**
  - **My class**: the section they are class teacher of. They can see full student details and documents.
  - **Subject classes**: sections where they teach a subject. These show a student list only.
  - They see nothing from other classes, and they can't open the Admin Portal.
- **What a teacher can change (own class only):** a student's photo, phone, WhatsApp, email, addresses and roll number (including *Auto-assign roll numbers*). They can also upload and delete student documents. Names, class, parents and other details stay with the school admin.
- **Account:** a teacher can change their own password under **Account**.

## Attendance

- **Who marks it:** the **class teacher** marks their own class in the Teacher Portal under **Attendance**. The **school admin** (or Power Admin) can mark any class under **Admin → Attendance**.
- **Taking attendance:**
  - Choose a date from the current session, up to today. Today is the default.
  - Everyone starts as **Present**. Mark students **Absent**, **Late**, **Half day** or **Leave**, and add an optional remark.
  - Click **Save**. You can change a saved day later; the latest save wins, and the page shows who saved it.
- **Holidays:**
  - **School holidays** are set by the admin under *Attendance → Holidays*: one day or a date range, with Sundays in a range skipped. No class takes attendance on those days. Marks saved earlier for that day are kept but not counted, and they count again if the holiday is removed.
  - A **class holiday** (for example a class picnic) can be marked by the class teacher or the admin from that day's sheet. It clears that day's marks for the class.
  - **Sundays** are treated as a weekly off. Attendance can still be taken on a Sunday if the school was open.
- **Reports:**
  - The admin **overview** shows every class for a day: marked or not, the counts, and the list of absent students.
  - Each class has a **monthly register** (a grid, with month and session percentages) that can be downloaded as Excel.
  - Student profiles show the session attendance percentage.
  - The admin dashboard lists the classes that haven't marked today.
- **Percentage:** present and late count as a full day, half day as half, and absent and leave as not attended. Holidays don't count.

## Project structure

```
prisma/
  schema.prisma          data model
  seed.ts                demo data
src/
  app/admin/             Admin Portal pages and server actions (one folder per module)
  components/            shared UI (ui.tsx) and form helpers (forms.tsx)
  lib/
    db.ts                Prisma client
    school.ts            getCurrentSchool() — every admin page and action goes through it
    codes.ts             student and teacher ID generation
    queries.ts           shared queries and formatters
    action-state.ts      form validation helpers (zod)
```

Every table is scoped to a `School`, so the planned Super Admin can manage several schools from one database.

## Not built yet

- Exams and report cards, fees, and the student/parent portal.
