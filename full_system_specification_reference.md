# AI-Driven Voucher Monitoring System

## Comprehensive Technical System Reference Document (v3.0)

---

### 1. System Overview & Architecture

AI-Driven Voucher Monitoring System is a decoupled multi-company financial voucher web platform. It automates budget request vouchers, multi-tier approvals, budget tracking, PDF generation, and machine-learning-assisted auditing.

#### Tech Stack Specification

- **Frontend Framework:** React 19 (built with Vite)
- **UI & Styling:** Tailwind CSS v4, ShadCN UI, Lucide Icons, Framer Motion
- **State & Data Fetching:** Zustand (Global State/Company Selector), Axios (HTTP Client)
- **Backend API Framework:** Laravel 11 (PHP 8.2)
- **Authentication:** Laravel Sanctum (Bearer Tokens)
- **Database Engine:** MySQL 8.x via XAMPP Local Development
- **PDF & Export Engines:** Laravel DomPDF (`barryvdh/laravel-dompdf`), Laravel Excel (`maatwebsite/excel`)
- **AI Engine & Languages:**
  - **Machine Learning Backend (Python 3.10+ & scikit-learn):** Handles classification, anomaly detection, and regression forecasting.
  - **LLM Integration (PHP / Laravel):** Direct integration with OpenAI API (`gpt-4o-mini` / `gpt-3.5-turbo`) for executive narrative generation.

---

### 2. Role Model & Workflow State Machine

#### User Roles & Access Boundaries

1. **Admin (`admin`):** System management role outside the voucher approval pipeline. Handles company creation, voucher types, payee_types, department assignment, user registration, company access control (`user_company_access`), global category management, and audit logging.
2. **Accounting Clerk (`accounting_clerk`):** Issuant user. Selects company context, creates/edits draft vouchers, uploads attachments, and submits vouchers for review.
3. **Accounting Officer (`accounting_officer`):** First-level approval. Manages department budgets, reviews pending vouchers, approves or rejects vouchers (transitions to Level 2), views anomaly reports, and generates financial summaries.
4. **Supervisor Manager (`supervisor_manager`):** Final approval authority. Mandatory approver for high-value and AI-flagged anomalous vouchers. Overrides anomaly flags with justification.

#### Voucher Life Cycle (State Transitions)

```
[DRAFT] --(Clerk Submits)--> [PENDING] --(AI Scans)--> [PENDING / FLAGGED]
                                |
                   (accounting_officer Level 1 Approval)
                                v
                         [UNDER REVIEW]
                                |
                   (supervisor_manager Final Approval)
                                v
                            [APPROVED] ---> Deducts Budget & Enables PDF Print
                                |
                     (Rejected at any stage)
                                v
                            [REJECTED] ---> Returned to Clerk with Remarks
```

---

### 3. Dynamic Company Context Architecture

1. **Database Multi-Tenancy:** Users are assigned permission to one or more companies via `user_company_access`.
2. **Frontend State:** Active selection is stored in Zustand (`useCompanyStore`).
3. **Middleware Interception:** Axios appends `X-Company-ID` to all HTTP headers.
4. **Laravel Global Scopes:** The API enforces data isolation using Laravel global scopes:
   ```php
   builder->where('company_id', request()->header('X-Company-ID'));
   ```

---

### 4. AI Features & Technical Implementation

| Feature                   | Primary Language & Tools                         | Execution Triggers                                                 | Output Action                                                                                       |
| :------------------------ | :----------------------------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Category Auto-Suggest** | Python (`scikit-learn`, `TF-IDF`, `Naive Bayes`) | Triggered on typing voucher description (API endpoint call).       | Returns category ID and confidence score.                                                           |
| **Anomaly Detection**     | Python (`scikit-learn`, `IsolationForest`)       | Triggered automatically on voucher submission.                     | Flags `ai_anomaly_flag = 1`, populates `ai_anomaly_reason`, requires mandatory Supervisor approval. |
| **Budget Forecasting**    | Python (`scikit-learn`, `LinearRegrdession`)     | Monthly scheduled command (`php artisan app:run-budget-forecast`). | Populates `ai_forecasts` table for upcoming 1-3 months.                                             |
| **Narrative Summaries**   | PHP (Laravel HTTP Client + OpenAI API)           | Triggered when generating financial reports.                       | Inserts markdown narrative into `financial_reports.ai_summary`.                                     |

#### AI Execution Strategy Options in Laravel

- **Option A (Subprocess via Terminal):** Laravel executes Python scripts directly using `Process` facade:
  ```php
  $process = Process::run("python3 storage/app/ai/classify.py \"" . $description . "\"");
  $result = json_decode($process->output());
  ```
- **Option B (Lightweight Microservice):** Python runs a simple FastAPI app on localhost (`127.0.0.1:8000`), called directly by Laravel using standard Axios/Guzzle HTTP requests.

---

### 5. Document Output Standard (Print/PDF)

Every approved voucher exported via Laravel DomPDF (`GET /api/vouchers/{id}/pdf`) includes:

- **Header:** Company Logo, Institution Name, Address, Document Title, Unique Voucher Number (`VCH-YYYY-XXXX`), Date Issued, Date Approved.
- **Payee Block:** Name, Payee Type, Department, Employee/Vendor ID, Payment Method, Bank Details.
- **Line Items Breakdown Table:** Particulars description, Quantity, Unit, Unit Price, Total Price, Amount in Words.
- **Budget Certification:** Account Code, Prior Available Budget, Remaining Budget post-deduction, Certification signature line.
- **Signatures & Stamps:** Prepared By (Clerk), Certified By (Accounting Officer), Approved By (Supervisor), AI Anomaly Flag Indicator badge (if flagged).
