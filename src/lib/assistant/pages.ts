// The Admin Portal's pages, for the assistant's "where do I…" answers. Each
// entry says what the page is for, the words people use for it, and the steps
// for the common jobs done there. Keep it in step with the app: a page that
// moves or a new feature belongs here, or the assistant will send people to
// the wrong place.

export type AppPage = {
  title: string;
  /** Path in the Admin Portal; ":student" etc. mark a record to pick first. */
  path: string;
  does: string;
  keywords: string;
  steps?: string[];
};

export const APP_PAGES: AppPage[] = [
  /* Dashboard and AI */
  { title: "Dashboard", path: "/admin", does: "Today at a glance: students, teachers, staff, present and absent today, today's fee collection, who is on leave, alerts for attendance not taken and sections without a class teacher.", keywords: "home overview summary today kpi alerts" },
  { title: "Ask AI", path: "/admin/assistant", does: "Ask questions about the school's data in plain English or Hindi.", keywords: "assistant ai chat question" },

  /* Students */
  { title: "Students", path: "/admin/students", does: "Search, filter and list students by class, section and more; open a student's profile.", keywords: "student list search pupils children roll" },
  {
    title: "New admission",
    path: "/admin/students/new",
    does: "Admit a new student: details, parents, class, then fees and transport, ending with a printable admission acknowledgement.",
    keywords: "admission admit new student enroll register",
    steps: ["Open Students → New admission", "Fill the student and parent details and pick the class", "Choose the fees and transport on the next steps", "Print the admission acknowledgement at the end"],
  },
  { title: "Import students", path: "/admin/students/import", does: "Add many students at once from a spreadsheet (CSV/Excel template).", keywords: "import upload excel csv bulk students" },
  {
    title: "Student profile",
    path: "/admin/students/:student",
    does: "One student's tabs: Overview, Examinations, Report card, Timetable, Notices, Admit card, Transport, Leave, Documents and Edit details.",
    keywords: "student profile details edit documents transport leave report card admit card",
    steps: ["Open Students and search the name", "Click the student to open the profile", "Use the tabs across the top (Report card, Leave, Transport, Documents, Edit details…)"],
  },
  {
    title: "Performance report",
    path: "/admin/students/:student/performance",
    does: "A two-page A4 analytics report for one student: progress across class tests and exams, attendance by month, subjects against the class, strengths, focus areas and suggested actions. Print or download as PDF.",
    keywords: "performance analytics report progress graph chart strengths weak subjects improvement",
    steps: ["Open the student's profile", "Go to the Report card tab", "Click Open report on the Performance report bar", "Print or Download PDF"],
  },
  { title: "Admission acknowledgement", path: "/admin/students/:student/acknowledgement", does: "Reprint a student's admission acknowledgement.", keywords: "acknowledgement admission slip print" },

  /* Teachers and staff */
  { title: "Teachers", path: "/admin/teachers", does: "List and search teachers; open a teacher's profile.", keywords: "teacher faculty list" },
  { title: "Add teacher", path: "/admin/teachers/new", does: "Add a new teacher.", keywords: "new teacher add hire" },
  { title: "Import teachers", path: "/admin/teachers/import", does: "Add many teachers at once from a spreadsheet.", keywords: "import teachers bulk excel" },
  { title: "Teacher profile", path: "/admin/teachers/:teacher", does: "A teacher's Overview (classes and subjects, Teacher Portal login), Timetable, Leave (requests and leave balance), Edit profile and Documents.", keywords: "teacher profile login password subjects leave balance" },
  { title: "Staff", path: "/admin/staff", does: "Non-teaching staff: list, add, open a profile.", keywords: "staff non teaching office driver guard peon" },
  { title: "Add staff", path: "/admin/staff/new", does: "Add a non-teaching staff member.", keywords: "new staff add" },
  { title: "Staff logins", path: "/admin/staff/logins", does: "Sign-ins for fees staff (cashiers / accountants) who only see the Fees pages.", keywords: "cashier accountant login fees staff access" },

  /* Attendance and leave */
  {
    title: "Attendance",
    path: "/admin/attendance",
    does: "Take or edit today's student attendance class by class, and see which classes have not taken it.",
    keywords: "attendance mark take present absent today",
    steps: ["Open Attendance", "Pick the class section", "Mark each student and save"],
  },
  { title: "Attendance register", path: "/admin/attendance/register", does: "School-wide attendance register: compares every class over a period, or opens one class's register (printable), with each student's percentage.", keywords: "register monthly attendance sheet print percentage low attendance compare classes" },
  { title: "Attendance lists", path: "/admin/attendance/list", does: "Everyone present, absent, late or on leave on a day, for students, teachers or staff (opened from the attendance cards).", keywords: "who is absent present on leave list today" },
  { title: "Proxy teachers", path: "/admin/attendance/proxy", does: "Assign substitute (proxy) teachers for teachers absent or on leave.", keywords: "proxy substitute arrangement absent teacher" },
  { title: "Staff attendance", path: "/admin/attendance/staff", does: "Mark attendance for teachers and staff; monthly staff register.", keywords: "staff attendance teacher attendance" },
  { title: "Weekly off", path: "/admin/settings/weekly-off", does: "Set the weekly offs: Sunday always, and Saturday if the school is closed. No attendance can be marked on a weekly off, and it isn't a working day.", keywords: "weekly off saturday sunday holiday five day week closed" },
  { title: "Holidays", path: "/admin/attendance/holidays", does: "Holidays that are not counted as working days for attendance.", keywords: "holiday off day attendance holiday" },
  {
    title: "Leave",
    path: "/admin/leave",
    does: "Leave requests of students, teachers and staff: approve or reject pending ones, filter by status and applicant, and search a name to see how many times they took leave.",
    keywords: "leave request approve reject pending on leave",
    steps: ["Open Leave", "Pending requests show first; open one to approve or reject", "Type a name in the search box to see that person's leave count and days"],
  },
  {
    title: "New leave request",
    path: "/admin/leave/new",
    does: "Enter leave for a student, teacher or staff member (can approve at once).",
    keywords: "apply leave new leave enter leave",
    steps: ["Open Leave → New leave request", "Pick the person, the dates and the leave type, and add the reason", "Submit, or tick approve now"],
  },
  { title: "Leave allowances", path: "/admin/leave/allowances", does: "Days of each leave type allowed per session for teachers and staff.", keywords: "leave allowance quota balance casual sick" },

  /* Fees */
  { title: "Fees overview", path: "/admin/fees", does: "Collections today and this month, dues by class, recent receipts.", keywords: "fees overview collection dues" },
  {
    title: "Fee desk",
    path: "/admin/fee-desk",
    does: "Collect fees: find a student, see their months paid and due with a summary card, open a month's bill, collect and print the receipt.",
    keywords: "collect fee payment fee desk counter pay receive money",
    steps: ["Open Fees → Fee desk", "Type the student's name, ID, father's name, phone or roll number in the search box (results appear as you type)", "Click Collect (or open a month)", "Enter the amount and mode, then save and print the receipt"],
  },
  { title: "Receipts", path: "/admin/fees/receipts", does: "All fee receipts: search, reprint, cancel; class-wise view.", keywords: "receipt reprint cancel payment history" },
  { title: "Fee structure", path: "/admin/fees/structure", does: "Fee heads (tuition, transport, annual…) and their amounts per class for the session.", keywords: "fee structure fee heads amount class tuition chart" },
  { title: "Fee ledger", path: "/admin/fees/students/:student/ledger", does: "A student's full fee ledger: every charge, payment and balance.", keywords: "ledger statement fee history account" },

  /* Expenses */
  { title: "Expenses", path: "/admin/expenses", does: "Monthly spending by category against budget, and salaries.", keywords: "expenses spending cost" },
  { title: "Expense list", path: "/admin/expenses/list", does: "Every expense entry; add or edit expenses.", keywords: "add expense bills entry" },
  { title: "Budget", path: "/admin/expenses/budget", does: "Monthly budget per expense category.", keywords: "budget plan" },
  { title: "Salaries", path: "/admin/expenses/salaries", does: "Pay salaries to teachers and staff and see who is still due.", keywords: "salary pay payroll" },

  /* Academics */
  { title: "Classes", path: "/admin/classes", does: "Classes and sections, class teachers and student counts.", keywords: "class section class teacher" },
  { title: "Assign teachers", path: "/admin/classes/assign", does: "Class teachers and subject teachers for the whole school on one screen.", keywords: "assign class teacher subject teacher allot teacher" },
  { title: "Promote students", path: "/admin/classes/:class/promote", does: "Promote a class's students to the next class for the new session.", keywords: "promote promotion next class new session" },
  { title: "Subjects", path: "/admin/subjects", does: "Subjects and which classes study them.", keywords: "subject curriculum" },
  { title: "Timetable", path: "/admin/timetable", does: "Class timetables; teachers' timetables; bell periods.", keywords: "timetable schedule periods" },
  { title: "Periods (bell schedule)", path: "/admin/timetable/periods", does: "The school's periods and their times.", keywords: "periods bell timing" },
  { title: "School calendar", path: "/admin/calendar", does: "Holidays, exams, PTMs and events; add an event.", keywords: "calendar event holiday ptm" },
  {
    title: "Exams & tests",
    path: "/admin/exams",
    does: "Create exams with their date sheet (papers, dates, max marks), print the date sheet; teachers create class tests.",
    keywords: "exam create date sheet schedule papers class test",
    steps: ["Open Exams & tests → New exam", "Pick the classes and add papers with dates and maximum marks", "Publish it so teachers can enter marks"],
  },
  {
    title: "Marks & results",
    path: "/admin/results",
    does: "Enter marks, see results per section, publish results, print report cards.",
    keywords: "marks results report card enter marks publish result rank topper",
    steps: ["Open Marks & results and pick the exam", "Pick the class section", "Enter marks, then Publish results", "Print or download report cards"],
  },
  {
    title: "Admit cards",
    path: "/admin/admit-cards",
    does: "Hall tickets with each student's exam schedule, for a whole section or one student; print or download as PDF. One student's admit card is also on their profile's Admit card tab.",
    keywords: "admit card hall ticket roll slip",
    steps: ["Open Admit cards", "Choose the exam", "Choose the class and section", "Print all, or use a student's row to print or download theirs"],
  },
  { title: "Houses", path: "/admin/houses", does: "School houses and their students.", keywords: "house team" },

  /* Office */
  {
    title: "Notices",
    path: "/admin/notices",
    does: "Send a notice by WhatsApp/SMS to whole classes, students absent on a day, chosen students, and teachers or non-teaching staff; with an optional attachment, publish date and expiry.",
    keywords: "notice message sms whatsapp circular send parents",
    steps: ["Open Notices", "Write the notice title and message", "Choose who gets it: classes, students absent on a day, chosen people, and also teachers or staff", "Pick the channel (WhatsApp or SMS) and send; check delivery under Sent notices"],
  },
  { title: "Sent notices", path: "/admin/notices/sent", does: "Notices already sent and their delivery status.", keywords: "sent notices delivery status" },
  { title: "Notice settings", path: "/admin/notices/settings", does: "WhatsApp and SMS provider settings.", keywords: "whatsapp sms api settings" },
  {
    title: "ID cards",
    path: "/admin/id-cards",
    does: "Print student ID cards (choose a class, then students) and staff ID cards; card design in settings.",
    keywords: "id card identity card print",
    steps: ["Open ID cards", "Choose the class, then pick the students", "Generate and print (teachers and staff have their own tab)"],
  },
  { title: "Transport", path: "/admin/transport", does: "Bus and van routes, stops with times and fares, riders; printable route sheet.", keywords: "transport bus van route stop driver" },
  { title: "Sessions", path: "/admin/sessions", does: "Academic sessions: start a new session, set the current one.", keywords: "session academic year new session" },
  { title: "Settings", path: "/admin/settings", does: "School details, logo and other settings.", keywords: "settings school details logo address" },
];

/** Pages matching the words of a question, best first. */
export function findPages(query: string, max = 5) {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return APP_PAGES.slice(0, max);
  return APP_PAGES.map((p) => {
    const title = p.title.toLowerCase();
    const hay = `${title} ${p.keywords} ${p.does.toLowerCase()}`;
    const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (p.keywords.includes(w) ? 2 : 0) + (hay.includes(w) ? 1 : 0), 0);
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.p);
}

const STOP = new Set(["how", "where", "the", "can", "and", "for", "what", "which", "page", "open", "find", "want", "need", "kaise", "kahan", "karna", "karu", "hai", "kare"]);
