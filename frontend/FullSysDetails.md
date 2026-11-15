# AI-Driven Voucher Monitoring System (ADVMS)

## Chapter 1: Project Overview

### 1.1 What Is ADVMS?

The AI-Driven Voucher Monitoring System (ADVMS) is a web-based financial management platform for institutions and organizations — primarily schools, but adaptable to any company. It digitizes and automates the entire voucher lifecycle: from employee budget requests, to voucher issuance by authorized personnel, through multi-level approval, all the way to reporting and AI-powered analysis.

The system is built on a **dynamic, company-switching architecture** — one user (the Issuant) can manage vouchers across multiple companies or departments without creating separate accounts. The dashboard, transaction history, budgets, and voucher context all update automatically to reflect the selected company.

### 1.2 System Flow (Plain Language)

| Step | Who Acts                      | What Happens                                                                                                                                                       |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Employee                      | An employee (Faculty, Registrar, Library, etc.) needs budget for something — travel, supplies, events. They submit a voucher REQUEST to the Accounting department. |
| 2    | Accounting Clerk (Issuant)    | Logs in and SELECTS the company/institution they are managing. The dashboard shifts to show that company's data, budgets, and history.                             |
| 3    | Accounting Clerk (Issuant)    | CREATES a voucher on behalf of the requesting employee — payee info, amount, category, description, supporting documents. AI auto-suggests the category.           |
| 4    | AI System                     | Scans the voucher for anomalies, auto-classifies it, checks if the amount is unusual vs. history, and flags it if necessary.                                       |
| 5    | Accounting Officer            | Reviews the voucher, checks if the department budget can cover it, then approves or returns it for revision.                                                       |
| 6    | Supervisor / Manager          | Gives final approval or rejection. Mandatory for AI-flagged or high-value vouchers.                                                                                |
| 7    | System                        | On final approval: deducts the amount from the department budget, logs the transaction, sends notifications, makes the voucher available for printing/export.      |
| 8    | Accounting Clerk / Accounting | Prints the official voucher (PDF) or exports transaction reports. AI generates narrative summaries of monthly spending.                                            |

### 1.3 The Dynamic Company-Switching Feature

Core architectural feature that makes ADVMS unique:

- Accounting Clerk sees a **Company Selector** dropdown at the top of the dashboard.
- Selecting a company (e.g., "University of Cebu" or "ABC Corporation") switches the entire system context:
  - Dashboard KPIs (total vouchers, budget used, pending approvals) reflect that company only.
  - Transaction history shows only that company's voucher records.
  - Budget allocations shown are specific to that company and its departments.
  - Creating a new voucher automatically tags it to the currently selected company.
- The Clerk can switch companies at any time — the context updates instantly without logging out.
- One Accounting Clerk can manage vouchers for a school, a foundation, and a corporate entity — all from one account.

> 📌 The company selector is always visible in the top navigation bar. Switching company does NOT affect vouchers from the previously selected company — all data is preserved per company.

### 1.4 Problem Statement

- Manual voucher creation on paper leads to errors, delays, and lost documents.
- No real-time visibility into how much budget each department has consumed.
- Approval processes rely on physical routing — slow and undocumented.
- No intelligent detection of anomalous or duplicate spending patterns.
- Multi-company institutions have no centralized platform to manage all their financial vouchers.
- Printing official vouchers requires reformatting data manually in Word or Excel.

### 1.5 System Goals

- Provide a centralized, role-based voucher management platform for multi-company use.
- Allow Accounting Clerks (Issuants) to create vouchers on behalf of requesting employees.
- Automate the approval workflow with audit trail and notifications.
- Integrate AI for anomaly detection, auto-classification, budget forecasting, and report summarization.
- Enable professional voucher printing with a standardized, complete format.
- Generate financial reports with AI-generated narrative summaries.

---

## Chapter 2: User Roles, Capabilities & Connections

### 2.1 Overview of All Roles

| Role                   | Also Known As                          | Primary Responsibility                                                                                   |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Accounting Clerk**   | Issuant / Voucher Creator              | Creates and issues vouchers on behalf of employees requesting budget. Manages company context switching. |
| **Accounting**         | Accounting Officer / Reviewer          | Reviews created vouchers, manages budget allocations, generates financial reports, views AI insights.    |
| **Supervisor Manager** | Department Supervisor / Final Approver | Gives final approval on vouchers. Monitors team performance, budget health, and AI anomaly flags.        |

### 2.2 Role 1: Accounting Clerk (Issuant)

The most active user in ADVMS — creates vouchers on behalf of employees who request budget. The bridge between employees who need money and the approval chain.

**Dashboard contents:**

| Widget                      | Description                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Company Selector (top bar)  | Dropdown always visible at the top. All data below refreshes on selection.                      |
| My Vouchers Summary         | Cards: Total Vouchers Created, Pending Approval, Approved, Rejected — for the selected company. |
| Recent Vouchers Table       | Most recently created vouchers with status badges (Draft, Pending, Approved, Rejected).         |
| Quick Create Voucher Button | CTA that opens the voucher creation form pre-filled with the selected company.                  |
| Notifications Panel         | Real-time feed of voucher status updates.                                                       |
| Monthly Submission Chart    | Bar chart of vouchers submitted per month for the selected company.                             |

**Features & capabilities:**

- Select company at any time from the top navigation bar.
- Create voucher — payee, amount, category, description, department, due date, attachments.
- AI category suggestion as description is typed.
- Attach documents (PDF, JPG, PNG).
- Save as draft.
- Submit for approval.
- Track status in real time.
- Print/export approved voucher as PDF in the official format.
- View full transaction history of the selected company.
- Edit and resubmit rejected vouchers.

**Cannot do:**

- Approve or reject any voucher.
- Set or modify budget allocations.
- Access other clerks' vouchers.
- View AI anomaly reports or forecasting panels.
- Generate system-wide financial reports.

### 2.3 Role 2: Accounting (Officer)

First-level approver and financial guardian of the system. Reviews vouchers created by Accounting Clerks, manages budget allocations per department, has full access to financial analytics and AI insights for the companies they oversee.

**Dashboard contents:**

| Widget                     | Description                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Company Selector (top bar) | Switch company context to view that company's data.                                          |
| Pending Approvals Queue    | Vouchers awaiting Accounting review, sorted by date/priority; flagged vouchers first.        |
| Budget Health Cards        | Per-department: Allocated, Used, Remaining, usage % with color indicators (green/amber/red). |
| AI Anomaly Alerts          | Vouchers flagged by AI as unusual, with the AI's reason.                                     |
| Budget vs. Actual Chart    | Line/bar chart comparing budgeted vs. actual spend per department per month.                 |
| AI Budget Forecast Widget  | AI-predicted spending for the next 1–3 months.                                               |
| Top Expense Categories     | Pie chart of which categories consume the most budget.                                       |

**Features & capabilities:**

- Approve / reject vouchers (first-level review), or return for revision with remarks.
- Set annual and monthly budget allocations per department per company.
- Real-time budget consumption monitoring per department.
- View AI anomaly flags with detailed reasoning.
- View AI budget forecast for upcoming months.
- Generate monthly/quarterly/annual financial reports (PDF or Excel).
- Get AI-generated narrative summary of any report.
- Full searchable/filterable voucher history for the selected company.
- Switch companies to view any company's financial data.
- Export voucher lists and budget summaries to Excel/CSV.

**Cannot do:**

- Give final approval on high-value or AI-flagged vouchers (requires Supervisor).
- Create vouchers on behalf of employees (Clerk's role).
- Manage system-wide user accounts or company setup (outside system scope).

### 2.4 Role 3: Supervisor Manager

Highest authority in the voucher workflow. Gives final approval on vouchers, oversees department financial health, and acts on AI anomaly alerts.

**Dashboard contents:**

| Widget                       | Description                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Company Selector (top bar)   | Switch company context to view any company's financial overview.                              |
| Final Approval Queue         | Vouchers that passed Accounting review and now need final approval/rejection.                 |
| AI Anomaly Alerts (priority) | All AI-flagged vouchers, with score, reason, and action buttons.                              |
| Department Budget Overview   | Per-department budget health summary cards, color-coded.                                      |
| Team Activity Feed           | Recent Accounting Clerk actions — vouchers submitted, amounts, departments.                   |
| Executive KPI Cards          | Total vouchers this month, total amount disbursed, % of budget used, # of anomalies detected. |
| AI Forecast Summary          | High-level prediction: will the company stay within budget next month?                        |

**Features & capabilities:**

- Final approve / reject — approved vouchers trigger budget deduction.
- Mandatory review of all AI-anomaly-flagged vouchers before approval.
- Override AI flags with a documented reason.
- View team performance by Accounting Clerk, company, and period.
- Monitor department-level budget burn rates, remaining balances, threshold alerts.
- Access and download executive financial summaries with AI narratives.
- Switch companies to view/approve vouchers for any managed company.
- View the full audit trail of every action on any voucher.

**Cannot do:**

- Create vouchers (Clerk's role).
- Set detailed budget line items per category (Accounting's role).

### 2.5 How the Three Roles Connect

**Accounting Clerk (creates voucher) → Accounting Officer (reviews & approves, Level 1) → Supervisor (final approval)**

- Clerk creates voucher → Status: **DRAFT**
- Clerk submits → Status: **PENDING** (enters Accounting's queue)
- Accounting reviews → approve: Status: **UNDER REVIEW** (enters Supervisor's queue) · reject: Status: **REJECTED** (back to Clerk)
- Supervisor reviews → approve: Status: **APPROVED** (budget deducted, voucher printable) · reject: Status: **REJECTED** (back to Clerk with remarks)
- All status changes trigger real-time in-app notifications to relevant parties.

---

## Chapter 3: Official Voucher Document Format

Defines the complete, professional format of a printed/exported voucher (PDF). All fields are required for the voucher to be legally and financially valid.

**Section A — Voucher Header:** Company Logo, Company Name, Company Address, Voucher Title ("DISBURSEMENT VOUCHER" / "PAYMENT VOUCHER"), Voucher Number (auto-generated, e.g., VCH-2025-0042), Date Issued, Date Approved.

**Section B — Payee Information:** Pay To (Payee Name), Payee Type (Employee/Vendor/Contractor/Supplier), Department, Employee ID / Vendor ID, Position/Designation, Bank/Payment Method (Cash/Bank Transfer/Check — with Bank Name, Account Number, Account Name if bank).

**Section C — Voucher Details:** Purpose/Description, Expense Category, Reference/Request Number, Period Covered, Due Date, Priority Level (Low/Normal/High/Urgent).

**Section D — Amount Breakdown Table:** Particulars | Qty/Unit | Amount (PHP) — itemized rows, TOTAL AMOUNT, and Amount in Words.

**Section E — Budget Certification:** Budget Account Code, Department Budget Available, Budget After Deduction (auto-computed), Certified Correct By (Accounting Officer name/signature).

**Section F — Supporting Documents Checklist:** Official Receipt/Invoice (required above ₱500), Purchase Request/Order, Certificate of Service/Completion, Travel Authority/Itinerary, Payroll/Payslip, Other (specify).

**Section G — Approval Signatures:** Prepared By (Accounting Clerk), Reviewed & Certified By (Accounting Officer), Approved By (Supervisor/Manager) — each with date line.

**Section H — For Accounting Use Only:** Check/JEV Number, Date Paid, OR Number, Received By, AI Anomaly Flag (shows "FLAGGED" badge with reason if applicable, visible to all approvers).

> 📌 The printed voucher is generated as a PDF using Laravel's DomPDF or Snappy library. All dynamic fields (company logo, amounts, names, budgets) are auto-populated from the database. Layout is a standard A4 page, landscape or portrait depending on content.

---

## Chapter 4: AI Features & Flow

### 4.1 AI Feature Overview

| AI Feature                   | When It Runs                 | Who Benefits            | Tech Used                  |
| ---------------------------- | ---------------------------- | ----------------------- | -------------------------- |
| Auto Category Classification | When Clerk types description | Accounting Clerk        | TF-IDF + Naive Bayes       |
| Anomaly Detection            | When voucher is submitted    | Accounting + Supervisor | Isolation Forest           |
| Budget Forecasting           | Monthly background job       | Accounting + Supervisor | Linear Regression          |
| AI Report Summarization      | When report is generated     | Accounting + Supervisor | OpenAI GPT API             |
| Smart Budget Alerts          | Continuous monitoring        | All roles               | Rule engine + AI threshold |

### 4.2 Auto Category Classification

**What it does:** As the Clerk types the voucher description, AI analyzes the text in real time and suggests the most likely expense category (e.g., "purchased bond paper and ballpen for the office" → "Office Supplies").

**How it works:**

- A TF-IDF vectorizer converts the description into numerical features.
- A trained Naive Bayes classifier (trained on historical voucher descriptions + categories) predicts the category.
- Suggestion appears as a highlighted badge below the description field with a confidence %.
- Clerk can accept with one click or manually override.

**Benefit:** Reduces manual effort, ensures consistent categorization, speeds up voucher creation. Model improves over time as more vouchers are submitted.

### 4.3 Anomaly Detection

**What it does:** When a voucher is submitted, AI scans it for unusual patterns — amounts significantly higher than the department's historical average for that category, duplicate submissions, or unusual payee patterns.

**How it works:**

- An Isolation Forest model trained on historical voucher data (amounts per category per department).
- New vouchers get an anomaly score; if it exceeds a threshold, `ai_anomaly_flag = TRUE`.
- AI generates a human-readable reason (e.g., "This Office Supplies voucher (₱45,000) is 3.2x higher than the monthly average of ₱14,000 for the Registrar department.")
- Flagged vouchers are highlighted in red in Accounting and Supervisor queues.
- Flagged vouchers require Supervisor's approval — Accounting alone cannot approve them.

**Benefit:** Proactively detects potential fraud, data entry errors, or budget abuse before funds are disbursed.

### 4.4 Budget Forecasting

**What it does:** Analyzes months of historical spending per department and predicts consumption for the next 1–3 months.

**How it works:**

- A Linear Regression model trained on monthly spending totals per department.
- Generates a predicted amount for the next month with a confidence score.
- A background Laravel scheduled command runs this on the 1st of each month.
- Results stored in the `ai_forecasts` table and shown on Accounting/Supervisor dashboards.

**Benefit:** Enables proactive financial planning instead of reactive budget firefighting.

### 4.5 AI Report Summarization

**What it does:** When a financial report is generated, AI produces a plain-language narrative summary for non-technical users.

**How it works:**

- After generating report data, the system sends a structured prompt to the OpenAI GPT API (gpt-3.5-turbo or gpt-4o-mini).
- Example prompt: report totals, top category, anomalies detected → "Write a 3-paragraph financial summary for a school administrator."
- The AI-generated summary is stored and displayed alongside the report.

**Benefit:** Makes financial reports accessible to department heads and administrators who aren't accounting experts.

### 4.6 Smart Budget Alerts

**What it does:** Continuously monitors budget consumption; when a department crosses defined thresholds (e.g., 80% of budget used), it notifies the Accounting Officer and Supervisor Manager.

**How it works:**

- After every voucher approval, a Laravel Observer recalculates the department's budget usage.
- Crossing 70%, 80%, or 90% thresholds creates an in-app alert.
- The 90% threshold also triggers an email notification.

**Benefit:** Prevents departments from unknowingly exhausting their budget mid-period.
