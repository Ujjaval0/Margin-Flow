# Project Rules & Development Guidelines: MarginFlow

These rules apply universally to all tasks, modifications, and conversations across the entire project.

---

## 1. Strict Instruction Adherence (Zero Scope Creep)
- **Follow Only What Is Instructed**: When given an instruction, implement strictly what is asked. Do not add supplementary features, unrequested enhancements, or speculative capabilities.
- **No Unsolicited Functionality**: Never add new options, new buttons, new modals, new workflows, or extra logic unless explicitly asked or strictly mandatory to fulfill the instructed functionality.

---

## 2. Zero Unsolicited UI / UX Alterations
- **Protect Existing UI**: Do NOT change component layout, styling, colors, borders, typography, spacing, shadows, animations, or visual structure unless the user explicitly asks to change the UI or a UI change is strictly required to enable the requested functionality.
- **Maintain Design Integrity**: Keep established Apple-inspired minimalism, clean elevated cards, stable navigation, and verified responsive layouts untouched.

---

## 3. Surgical & Minimal Modifications
- **Touch Only Necessary Code**: Modify only the exact files, functions, and lines of code required to fulfill the instruction.
- **No Unrelated Refactoring**: Do not reformat, rewrite, or reorganize unrelated files, components, functions, or imports.
- **Preserve Documentation & Comments**: Keep existing comments, docstrings, and invariants intact unless directly invalidated by the requested change.

---

## 4. Requirement Verification & Safety
- **Build Cleanliness**: Ensure that any change compiles with zero TypeScript errors and zero runtime warnings (`npm run build`).
- **No Regressions**: Changing a specific functionality must never break existing deterministic calculations, ledger invariants, or navigation state.

---

## 5. Permanent UI/UX Standards & Invariants
- **Authoritative Standard Document**: All UI and interaction work must strictly comply with [`UI_UX_STANDARDS.md`](./UI_UX_STANDARDS.md).
- **The Dark Tint Rule**:
  - All modal backdrops MUST use `bg-black/30 backdrop-blur-xs`.
  - Heavy blurs (`backdrop-blur-md`, `backdrop-blur-lg`, `backdrop-blur-xl`) are strictly prohibited on backdrops.
  - All modal windows and confirmation dialogs MUST portal to `document.body` via `createPortal(jsx, document.body)` with a `mounted` safety check so the dark tint spans the entire viewport (including Sidebar and Navbar).
- **Modal Dismissal Invariants**:
  - Tapping anywhere outside the modal card (on the backdrop) MUST close the modal.
  - Pressing the <kbd>Escape</kbd> key MUST close the active modal.
  - Every modal card and confirmation dialog MUST include a circular close "X" button in the top-right header.
- **Minimalist Workflows**:
  - In file upload / CSV import dialogs, do not add unsolicited template download buttons or verbose AI marketing text.

