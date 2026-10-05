# UI & UX Standards and Design System: MarginFlow

This document defines the permanent, mandatory UI and UX design specifications, interaction invariants, and styling standards for MarginFlow. These rules must be strictly preserved across all future updates, additions, and modifications.

---

## 1. The Global Modal & Backdrop Standard (NON-NEGOTIABLE)

Every modal window, confirmation dialog, slide-over drawer, and inspection sheet across the entire application must adhere to this exact specification.

### 1.1 Full-Viewport DOM Portal (`createPortal`)
- **Requirement**: All modals must render into `document.body` via `createPortal(jsx, document.body)`.
- **Why**: Rendering modals inline inside page components traps the `fixed inset-0` backdrop inside `<main>` and the route transition wrapper. This causes the left Sidebar and top Navbar to remain bright white and un-tinted. Portaling to `document.body` ensures the dark overlay spans the **entire viewport**, covering the Navbar, Sidebar, and Content simultaneously.
- **Hydration Safety**: Every portaled modal must be guarded with a `mounted` state:
  ```tsx
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return createPortal(...);
  ```

### 1.2 Backdrop Appearance & Tint (The Dark Tint Rule)
- **Uniform Tint Overlay**: `bg-black/30` (30% pure black alpha tint).
- **Subtle Blur Only**: `backdrop-blur-xs` (or `backdrop-blur-[2px]`).
  - **STRICT PROHIBITION**: NEVER use heavy blurs such as `backdrop-blur-md`, `backdrop-blur-lg`, or `backdrop-blur-xl` on modal backdrops. Excessive blur causes visual distortion and was explicitly rejected.
- **Entrance Animation**: `animate-in fade-in duration-150` (or `duration-200`).
- **Standard Backdrop Class**:
  ```html
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
  ```

### 1.3 Outside-Tap Dismissal (Click-to-Close)
- Tapping or clicking anywhere on the screen outside the modal card MUST immediately close the modal.
- **Implementation Pattern**:
  ```tsx
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 ..."
    onClick={onClose} // Closes when clicking backdrop
  >
    <div
      className="apple-card bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] ..."
      onClick={(e) => e.stopPropagation()} // Prevents clicks inside the modal from closing it
    >
      {/* Modal Content */}
    </div>
  </div>
  ```

### 1.4 Keyboard Dismissal (<kbd>Escape</kbd> Key)
- Pressing the <kbd>Escape</kbd> key MUST close any active modal, dialog, or drawer.
- **Implementation Pattern**:
  ```tsx
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  ```

### 1.5 Header Close "X" Button
- Every modal card and confirmation dialog (including single and bulk delete confirmations) MUST include a clean circular close "X" button in the top-right corner.
- **Standard Close Button Styling**:
  ```tsx
  <button
    type="button"
    onClick={onClose}
    aria-label="Close dialog"
    className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
  >
    <X className="w-3.5 h-3.5" />
  </button>
  ```

---

## 2. Modal Card & Container Aesthetics

- **Card Container**: `apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] overflow-hidden animate-in zoom-in-95 duration-150`
- **Card Header**: `px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]`
- **Card Footer**: `px-6 py-4 border-t border-black/[0.05] bg-slate-50/50 flex justify-end gap-2.5 shrink-0`
- **Subtle Separation Lines**: `border-black/[0.04]` to `border-black/[0.06]`. Never use harsh opaque borders.

---

## 3. Destructive & Confirmation Dialogs (Delete Order, Bulk Delete, Supplier Delete)

- **Structure**:
  - Max width: `max-w-md` or `max-w-sm`.
  - Icon badge: Dual-tone rose container (`w-9 h-9` or `w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-[#D70015] flex items-center justify-center shrink-0`).
  - Top-right close "X" button: Always present.
- **Action Buttons**:
  - Cancel: `px-4 py-2 bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] rounded-full text-xs font-semibold transition cursor-pointer active:scale-95`
  - Destructive Confirm: `px-4 py-2 bg-[#D70015] hover:bg-[#B20010] text-white rounded-full text-xs font-semibold transition shadow-apple-sm cursor-pointer active:scale-95`

---

## 4. Typography & Branding

- **Brand Header ("Margin Flow")**:
  - Located in the persistent Sidebar and Navbar.
  - Sizing & Weight: Prominent `text-xl font-bold tracking-tight text-[#1D1D1F]`.
  - High legibility, crisp rendering, Apple typography scale.
- **Monochrome & High-Contrast Accents**:
  - Primary text: `#1D1D1F`
  - Secondary text / Subheadings: `#6E6E73`
  - Tertiary / Captions: `#86868B`
  - Neutral card background: `#FFFFFF`
  - Platform canvas background: `#F5F5F7`

---

## 5. CSV Import & File Upload Workflows

- **Minimalist & High-Signal UX**:
  - **No Useless Clutter**: Do not show unnecessary template download links (e.g. Amazon, Flipkart, Meesho template download buttons).
  - **No Boilerplate Filler**: Avoid verbose AI heuristics descriptions or marketing copy inside operational upload dialogs.
  - **Direct Upload**: Clean dropzone accepting CSV and Excel spreadsheets with auto-parsing and instant column mapping preview.
- **Auto-parse Invoice Button**:
  - Dual-tone modernized icon badge using `ScanLine` / `Sparkles`.
  - Clean action button in the Orders action toolbar.

---

## 6. Standardized Component Checklist

The following components have been fully standardized and verified against this specification:

| Module / Component | File Location | Portal to Body | Backdrop Style | Dismiss on Outside Tap | Escape Key | Close "X" Button |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `OrderModal` (+ Add / Edit Order) | `src/components/modals/order-modal.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Delete Order (Single) | `src/components/modules/orders-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Delete Orders (Bulk) | `src/components/modules/orders-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Order Profitability Breakdown | `src/components/modules/orders-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| `CsvImportModal` (Orders) | `src/components/modals/csv-import-modal.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| `InvoiceAutoParseModal` | `src/components/modals/invoice-auto-parse-modal.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| `DisputePacketModal` | `src/components/modals/dispute-packet-modal.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| `AISettingsModal` | `src/components/ai/ai-settings-modal.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| `CfoCopilot` (Drawer) | `src/components/ai/cfo-copilot.tsx` | Root | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Record Recovery Credit | `src/components/modules/claims-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Edit Claim Modal | `src/components/modules/claims-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Record Operating Overhead | `src/components/modules/expenses-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Edit Operating Expense | `src/components/modules/expenses-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Delete Expense (Single & Bulk) | `src/components/modules/expenses-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Cost Basis History Drawer | `src/components/modules/products-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Revise Unit Cost Modal | `src/components/modules/products-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Add Catalog Product Modal | `src/components/modules/products-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Log Reverse Logistics Modal | `src/components/modules/returns-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Edit Return Record Modal | `src/components/modules/returns-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Deduction Taxonomy Drawer | `src/components/modules/settlements-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Record Settlement Deposit | `src/components/modules/settlements-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Record Vendor Payout | `src/components/modules/suppliers-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Delete Supplier Confirmation | `src/components/modules/suppliers-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Channel Connection Sheet | `src/components/modules/webhook-simulator.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
| Document Upload Modal | `src/components/modules/ai-staging-view.tsx` | Yes | `bg-black/30 backdrop-blur-xs` | Yes | Yes | Yes |
