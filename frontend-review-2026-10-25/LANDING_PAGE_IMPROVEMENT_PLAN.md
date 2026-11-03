# MarginFlow landing-page improvement plan

25 October 2026 · Planning document · Application changes have not started

**Objective**

A visitor without marketplace or accounting knowledge should understand what MarginFlow offers, whether it is relevant to them, how it helps, and what happens after clicking its primary action. Improve the visual presentation around that explanation while retaining the existing MarginFlow identity.

The primary audience remains Indian online sellers. Making the explanation accessible to everyone does not mean suggesting that the product serves every industry or every kind of customer.

**Scope and boundaries**

- Public landing page, its navigation, copy, examples, visuals, responsive behavior, accessibility, and the immediate signup/sign-in handoff.
- Preserve the existing emerald identity, logo, current font families, clean elevated surfaces, and established interaction standards.
- Reuse and reshape the current landing components. Keep changes local to the public experience wherever possible.
- Private dashboard layouts, accounting calculations, records, integrations, claim states, and onboarding workflows remain separate work. The prior review documents their issues; this plan does not implement them indirectly.
- No new live-demo application, AI features, popups, lead-capture forms, invented testimonials, or speculative product capabilities.

**Proposed message**

Audience description: “Financial software for Indian online sellers.”

Headline: **“Understand what you earn from every order.”**

Supporting explanation:

> Bring your orders, product costs, returns, and marketplace payouts into one place. Understand your profit, investigate unexpected deductions, and prepare dispute claims for you to submit to the marketplace.

Short setup explanation:

> Create your account, then connect a supported channel or upload your data. Add product costs to understand your margins.

This wording must be checked against the available product paths before implementation. It is proposed copy, not a new guarantee of full automation, exact recovery, or complete profit from incomplete data.

**Recommended page sequence**

```text
Navigation
  ↓
Hero: who it is for + what it does + next action + labeled example activity
  ↓
Three benefits: understand profit / check payouts / manage return losses
  ↓
Interactive product example: orders / returns / claims / payouts
  ↓
How it works: provide data → review findings → take action
  ↓
Short factual comparison with manual work, if it adds useful context
  ↓
Questions: setup, supported channels, responsibilities, costs, data handling
  ↓
Final action + concise offer/setup information
  ↓
Footer: policies + support + company information
```

Reuse the existing sections to tell this story. Remove duplication rather than increasing page length. Commercial information should also be visible near the primary conversion point; do not leave a material cost or free-offer limit exclusively inside a collapsed FAQ.

**Section-by-section changes**

| Step | Area | Planned change | Result for the visitor |
|---|---|---|---|
| 1 | Navigation | Replace specialist labels with “How it works,” “Product example,” “Benefits,” and “FAQ.” Keep sign-in separate from the primary account-creation action. Update anchors to match the final order. | Visitors can predict where each link leads. |
| 2 | Hero copy | State the audience and software category, use the proposed plain-language headline, and explain the core service in two short sentences. Put the setup expectation next to the action. | The service is understandable from the first screen. |
| 3 | Hero visual | Keep the existing example-activity surface, clearly label it “Example activity,” and remove the claim that four channels are actually connected. Use short event descriptions; remove automatic-filing implications. Reduce competing background motion. | The visual demonstrates the service honestly and remains easy to read. |
| 4 | Benefits | Repurpose the current numerical-results area into three concrete benefit statements unless genuine evidence is supplied. Suggested labels: “Understand order profit,” “Check marketplace payouts,” and “Track return losses and claims.” | People understand why the software is useful without decoding percentages or acronyms. |
| 5 | Product example | Keep the existing four-tab interaction. Rename tabs to “Order profit,” “Returns,” “Claim preparation,” and “Marketplace payouts.” Show the controls above the changing content, with a clear selected state. Add a visible sample-data label. | Visitors notice that they can explore the examples, including on mobile. |
| 6 | Financial example | Replace the incorrect bank-cash/profit labeling. Show selling price, product cost, fees, and the remaining contribution amount, with a brief note about excluded costs. Keep payouts as a separate concept. Remove “true net profit” labels where the sample does not include all relevant costs. | The example teaches the distinction between sales, payouts and profit. |
| 7 | How it works | Reshape the existing data-flow diagram into three explanatory steps: provide orders and costs; review profit and payout differences; investigate issues or prepare a claim. State which inputs are needed and where review is required. | The visitor understands the work involved and the output they receive. |
| 8 | Manual comparison | Remove unsupported 5/8/8-day stages, the universal claim deadline, and automatic “reconciled books on upload” promises. If retained, use a concise comparison of tasks the user performs manually and tasks MarginFlow helps with. | The time-saving argument becomes credible and understandable. |
| 9 | Proof and ROI | Remove the unsupported percentage/hour/compliance claims and decorative ROI curve from the initial revision. Include quantified proof only when a source, timeframe, population and meaning are available. | Confidence comes from accurate examples and evidence. |
| 10 | FAQ | Rewrite questions around basic customer concerns. Explain channel-specific connection methods, manual claim submission, required costs/data, accounting-tool overlap, the offer, and verified data handling. Remove references to unavailable destinations such as the currently inaccessible supplier-document vault. | Common questions are answered in ordinary language and match the actual product. |
| 11 | Final CTA | Repeat the same primary action used in the hero. Explain what happens next. Replace the “60 seconds” guarantee with a factual setup expectation. Put verified offer/pricing information nearby. | The visitor can decide whether to begin without guessing about commitment or requirements. |
| 12 | Footer | Add working destinations for supplied Terms, Privacy and support information. Replace the generic security-to-FAQ link with a factual, clearly named destination or specific answer. Keep company information accurate. | Visitors can find who provides the service, how to get help and how their data is handled. |

**CTA behavior**

Use a conservative, concrete baseline while free-offer details remain unconfirmed:

- Primary: **“Create your account”** → signup mode.
- Secondary: **“See an example”** → the existing on-page product preview.
- Returning customer: **“Sign in”** → sign-in mode directly.
- Replace “Explore Live Demo” and “Open in app” wording where they imply immediate access to a public demo. Remove duplicate actions within the example if the main page action already provides the same path.
- Any loading text should describe the action underway. Navigating to signup should not say “Connecting,” because a store connection has not started.

If the business confirms a genuine free audit, a later copy decision can use “Start your free audit,” accompanied by its actual limits and account requirement. Do not invent those limits or describe a trial as permanently free.

**Visual direction**

The current brand is strong enough to retain. The improvements should make information more visible and the page easier to scan.

- Color: retain dark emerald `#060C09`, brand green `#124B20`, accent green `#00872E`, soft canvas `#F6F9F5`, white `#FFFFFF`, and primary text `#193022`. Adjust individual supporting-text colors where necessary for readability.
- Typography: keep the existing font families. Use one clear headline hierarchy and short supporting paragraphs. Retain serif emphasis selectively; reduce repeated all-capital technical captions and decorative labels.
- Composition: one dominant message and primary action in the hero, a supporting example beside it on desktop, and a readable vertical sequence on mobile. Align headings, content widths and action placement between sections.
- Controls: make the primary action clearly stronger than the secondary action. Use consistent labels, padding, selected states and touch spacing.
- Surfaces: reuse established rounded cards, subtle borders and neutral elevation. Avoid adding nested decorative cards around every sentence.
- Motion: reduce persistent movement that competes with reading. Keep useful feedback when a user changes a preview tab. Respect the existing reduced-motion support.
- Product storytelling: use the existing code-based preview and diagrams. New stock imagery or generated artwork is unnecessary for this explanation.

**Responsive and accessibility work**

- Reflow process diagrams vertically on narrow screens. The core explanation must be readable without sideways scrolling or hidden outputs.
- Keep preview navigation visible before the content; prevent long examples from burying the controls.
- Account for the fixed navbar with section scroll offsets so anchor navigation does not cover headings.
- Keep headings, sample amounts and CTAs within the viewport at 320px, 390px, 768px, 1024px and 1440px widths.
- Provide visible keyboard focus and readable small text, including the signup handoff where relevant.
- Give FAQ controls their expanded state and controlled-panel relationships. Expose selected preview states with an appropriate accessible control pattern.
- Give the mobile menu an expanded state, Escape dismissal and sensible focus behavior. If it is implemented as a modal/drawer, apply all project portal, backdrop and dismissal standards.
- Associate signup labels with their inputs and keep the password-visibility control keyboard reachable if the handoff form is edited.
- Validate readability at browser zoom and with reduced motion. Do not change global workspace styles to solve a landing-only issue.

**Facts needed before final publication**

These are business or product facts, not details to invent in design copy. Copy and layout work can proceed using the conservative wording above.

| Fact | Needed information | Safe treatment until available |
|---|---|---|
| Free offer | What is free, duration, limits, card requirement and what happens afterward. | Use account-creation wording; remove unverified free/no-card promises. |
| Pricing | Actual prices or the real process for obtaining a price. | Do not invent tiers, prices or a sales-contact path. Treat this as a publication requirement. |
| Channel support | What each channel supports through direct connection versus file import, and its prerequisites. | Describe only the verified methods. |
| Claims | What is prepared, evidence requirements and who submits to the marketplace. | Describe claim preparation and manual submission accurately. |
| Evidence | Verifiable customer outcomes, measurement period, sample and permission to publish. | Use factual benefit descriptions and labeled product examples. |
| Policies and support | Approved Terms/Privacy content, real company details, actual support destination and verified data-handling facts. | Do not publish placeholder policies, addresses or unsupported security assurances. |

**Implementation sequence and likely files**

1. **Copy and claim alignment.** Create one consistent vocabulary, finalize the proposed message, remove unverified claims and define the CTA destinations. Sources: `src/app/page.tsx` and the existing landing components.
2. **Story and visual composition.** Reorder the existing sections, revise the hero, move the product example earlier, repurpose results into benefits, and simplify the process/comparison. Sources: `marginflow-hero.tsx`, `marginflow-compound-metrics.tsx`, `marginflow-workspace-showcase.tsx`, `marginflow-flow-machine.tsx`, `marginflow-route-comparison.tsx`.
3. **Navigation and conversion handoff.** Update `marginflow-navbar.tsx`, `marginflow-footer.tsx` and CTA handlers. Make the minimal change in `src/app/login/page.tsx` needed to honor an explicit sign-in versus signup destination. Update the FAQ and final CTA in `src/app/page.tsx`.
4. **Responsive and accessibility pass.** Fix mobile diagrams, anchor offsets, readable captions, keyboard controls and disclosure states within the affected components. Scope any necessary CSS carefully.
5. **Policy/offer integration.** Add supplied factual content and working destinations. Create simple policy routes only when approved content is available; this does not require a new modal or workflow.
6. **Verification.** Run `npm run build`, check for TypeScript errors, inspect changed pages for runtime warnings, verify CTA destinations, exercise keyboard/mobile interactions, and capture before/after evidence. Confirm the private workspace is unaffected by any shared-file changes.

The order allows factual copy problems to be corrected before investing in decorative refinements. Implementation should remain surgical, with no unrelated refactoring.

**Acceptance checks**

- [ ] A first-time visitor can identify the product category, intended customer, primary benefit and next action from the hero.
- [ ] A non-domain reviewer can explain what data they provide, what result they receive and what remains their responsibility after reading the page.
- [ ] Each CTA opens the destination described by its label. Sign-in opens sign-in; an example remains an example.
- [ ] Sample figures and activity are labeled. No public sample claims to be an actual customer connection or payout.
- [ ] Financial examples distinguish payout from profit and clearly identify the meaning of the remaining amount.
- [ ] No claim-preparation copy implies external filing or guaranteed recovery.
- [ ] Every quantitative result is supported and contextualized, or removed.
- [ ] Offer, pricing, policy and support information is factual and discoverable before the relevant commitment.
- [ ] The main explanation is readable on mobile without horizontal scrolling; headings remain visible after anchor navigation.
- [ ] Preview tabs, FAQ, navigation and the immediate handoff work with a keyboard and expose their relevant states.
- [ ] The production build succeeds with no TypeScript errors; changed flows are checked for runtime warnings.
- [ ] Before/after screenshots cover desktop and mobile. An actual first-time reviewer is used for the comprehension check where available; this is not replaced by an invented conversion score.

**Expected result**

A more appealing landing page in which the message, examples and visual hierarchy explain the service together. Visitors should understand what MarginFlow can help with and feel confident about the next step, with the existing brand and product functionality preserved.
