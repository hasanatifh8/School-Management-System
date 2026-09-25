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

## Student ID cards

- **Step by step** (Admin → **ID cards**):
  1. **Choose a class.** Each class shows its student count and how many have no photo.
  2. **Pick students.** Search and tick students (or *Select all*), then click **Generate**. Each row's **Card** link makes one student's card straight away.
  3. **Download or print** only the students you picked, up to 100 at a time, so the page stays quick.
  - Class teachers have the same steps for their own class under **ID cards** in the Teacher Portal.
  - A student profile's **ID card** button goes straight to step 3 for that student.
- **What's on the card** (standard 54 × 85.6 mm, portrait):
  - **Front:** school logo, name and motto; the student's photo, name, class, section, roll number, admission number, date of birth, blood group and parent contact; a QR code; and "valid till" (the end of the session).
  - **Back:** the school's address, phone, email and website, a principal signature line, and "If found, please return to the school".
  - The school details come from what **Power Admin enters for the school**. Missing details are listed, and those spaces are left blank.
- **QR code:** plain text (school, name, admission number, class and roll, date of birth, blood group, parent) that any phone camera reads offline.
- **Images:**
  - **Sizes:** Print quality 300 DPI (638 × 1011 px), High-res print 600 DPI (1276 × 2023 px), Phone/WhatsApp (540 × 856 px), or a custom width from 200 to 4000 px. The height follows the card's shape.
  - **Formats:** PNG or JPG.
  - **One student:** download the front, the back, or front and back side by side in one image.
  - **Several students:** download a single ZIP with each student's front and one back image, or use the download link under any card.
- **Printing:** choose a layout (**Double-sided**, **Front and back side by side**, or **Front only**) and click **Print**. In the print window, turn on **Background graphics** and keep the scale at **100%**. For double-sided printing, flip on the long edge.

## Fees

**Who can use it**
- **School admins** and Power Admin have full access.
- **Fees staff** (non-teaching staff such as the accountant) have their own logins, created by a school admin under **Admin → Staff → Fees logins**. They sign in at `/login` like admins, but see only the **Fees** section: collecting fees, receipts and the fee chart. Opening any other admin page takes them back to Fees.

**Fee structure** (*Fees → Fee structure*, admins only)
- Fees are set up for each academic session. Add each fee the school charges and choose **how often** it is charged:

  | How often | When it's charged |
  |---|---|
  | **One time** | Once, to students admitted this session (e.g. admission fee) |
  | **Monthly** | Every month of the session |
  | **Quarterly** | Apr, Jul, Oct, Jan |
  | **Half-yearly** | Apr and Oct |
  | **Once a year / extra due** | Once, in the month you choose (annual charges, exam fee, event fee…) |

- Each fee has its **own amount for each class**. Leave a class blank to skip it (*Fill all classes* sets the same amount everywhere).
- Each fee has a **due day**. After that day it shows as overdue.
- **Only for students who opt in** is for fees like transport or hostel. Add students to it from their fee page.
- The chart shows the yearly total per student for every class.
- A new session starts empty; **Copy fees from the previous session** copies them over.

**Collecting fees** (*Fees → Collect fees*)
1. Find a student by name, ID, father's name or phone, or open a class to see who owes what.
2. The student's fee page lists every instalment for the session: **Due**, **Part paid**, **Paid** or **Upcoming**. Everything due up to today is ticked.
   - Change amounts for a part payment (you can't pay more than the balance).
   - Tick upcoming instalments to take an advance.
3. Choose the date and how it was paid (Cash, UPI, Card, Cheque, Bank transfer, Other). UPI, cheque and bank transfer need a reference number.
4. Click **Collect**. A numbered receipt is created (e.g. `2026-27/0001`) and opens ready to print.
- Students who join mid-session are charged only from the month they were admitted.

**Receipts**
- Each receipt shows the school details, the student, the fees paid (consecutive months shown as one line), the total and the amount in words.
- It prints on A4 with a **parent copy and an office copy**, or as a single copy.
- *Fees → Receipts* lists receipts by date with totals by payment mode.
- Receipts are never deleted. An admin can **cancel** one with a reason: it stays on record marked "Cancelled", and its amounts become due again.

**Overview:** collected today, this month and this session; today's collection by payment mode; recent receipts; and the amount due now in each class.

## Expenses & budget

This section is for school admins and Power Admin. Fees staff can't see it.

**Staff** (*Admin → Staff*)
- The **Non-teaching staff** register holds office staff, guards, helpers, drivers and so on, each with a job, phone number and monthly salary. You can edit someone or remove them from the payroll; their past salaries are kept.
- The **Fees logins** tab holds sign-in accounts for fees staff.
- Teachers' salaries come from the *Monthly salary* on their profile.

**Salaries** (*Expenses → Salaries*)
- The month's payroll lists teaching and non-teaching staff, each marked paid or unpaid.
- **Pay** one person, changing the amount for deductions or bonuses and adding a note, or **Pay all** the unpaid people at their monthly salary on one date.
- A payment can be undone.
- The totals show teaching and non-teaching salaries separately.

**Expenses** (*Expenses → Expenses*)
- Record bills and payments by category: electricity, water, events, maintenance, stationery, transport, internet, cleaning, and so on.
- Categories can be added or removed on the Budget tab.

**Budget** (*Expenses → Budget*)
- Set a **monthly budget** for each category, including Salaries. The same budgets apply to every month.
- Each category shows a **suggested** amount:
  - Salaries: the current payroll.
  - Other categories: the average of the last 3 months plus 10%, rounded up to ₹500.

**Overview**
- For any month, it shows what was spent against the budget, marked under budget, near the limit or over budget.
- Summary tiles show:
  - salaries paid (teaching and non-teaching)
  - other expenses
  - **expected spending by month end**, and next month
  - fees collected, and the balance left after spending
- A 6-month spending chart, and a table by category with the budget, spending, percentage used, usual monthly amount, expected amount and status.
- **Recommendations** are worked out from the numbers:
  - categories over budget or likely to go over
  - unusual spikes, meaning 30% or more above the usual amount
  - salaries still to pay, including anything unpaid from last month
  - staff with no salary set, and categories with no budget
  - spending compared with fees collected
  - next month's expected cost
- **How the forecasts work:**
  - The usual amount for a category is its average over the previous 3 months that have spending recorded.
  - Expected by month end is, for salaries, what's already paid plus the salaries still due; for other categories, the higher of the amount spent so far and the usual amount.
  - Next month is the current payroll plus each category's recent average.

## Notices (WhatsApp & SMS)

**Settings** (*Admin → Notices → WhatsApp & SMS settings*)
- Connect a WhatsApp provider and an SMS provider:

  | Channel | Providers |
  |---|---|
  | WhatsApp | **WhatsApp Cloud API (Meta)**, **Twilio**, **Other provider (HTTP)** |
  | SMS | **Fast2SMS**, **Twilio**, **Other provider (HTTP)** |

  - **Other provider (HTTP)** works with any provider that has an HTTP API (MSG91, Gupshup, Interakt, WATI, Textlocal…). Enter the URL, headers and body with `{phone}`, `{phone10}` and `{message}` placeholders.
  - **Test mode** records messages without sending anything.
- Meta WhatsApp: messages to parents who haven't messaged you in the last 24 hours need an **approved template** with one body variable `{{1}}`. The notice text goes into it.
- **Send test** sends a test message to any number.
- You can **turn off** a channel, and decide whether class teachers may send notices.
- API keys are stored **encrypted** (AES-256-GCM) using the `SECRETS_KEY` environment variable, and are never shown again after saving.
  - Set `SECRETS_KEY` to a long random value locally (`.env`) and on Vercel.
  - Changing it means entering the keys again.

**Sending**
- **Admins** (*Notices → Send notice*) can send to selected classes, individual students, students **absent** on a day (from attendance), or the whole school.
- **Class teachers** (*Teacher Portal → Notices*) can send to their whole class, their absent students, or students they pick. Other classes are never included.
- Choose WhatsApp, SMS or both. Write the message, or start from a template (Absent today, Holiday, Fee reminder, Parent-teacher meeting).
- Placeholders are filled in for each student: `{student}`, `{class}`, `{roll}`, `{father}`, `{date}`, `{school}`.
- **Review** shows how many messages will go out, how many students have no number, and a sample message. Then **Send**.
- WhatsApp uses the student's WhatsApp number, or their phone number if there isn't one. SMS uses the phone number.
- Attendance has shortcuts: **Message parents** on the admin absent list, and **Message absent parents** on the teacher's attendance page.

**Delivery**
- Messages are sent in the background (up to 60 seconds after sending), and also while the notice page is open. They're never sent twice.
- Each notice shows every recipient as **Sent**, **Failed** (with the provider's error), **Skipped** (no number) or **Waiting**. **Retry failed** tries the failed ones again.
- *Notices → Sent* lists all notices from admins and teachers.

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

- Exams and report cards, and the student/parent portal.
