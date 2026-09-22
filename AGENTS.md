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
