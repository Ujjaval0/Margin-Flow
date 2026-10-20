# My Technical Foundations and Communication Guide

**Purpose:** Personal learning for the owner of MarginFlow. This document is not application documentation, a production checklist, or an instruction to change the project. All sample requests are educational examples, not authorized work.

**Basis:** Patterns observed in the available MarginFlow / Evals checking conversations. Historical examples describe communication patterns; they do not establish the current state of the application.

## How to use this guide

You do not need to sound like a developer to give a useful instruction. You need to describe the situation, distinguish facts from guesses, and explain what would demonstrate success.

Learn the terms in context. Start with sections 1–3, then work through one section at a time. Use section 14 when rewriting a request and section 17 to practice. This covers the foundations you are likely to use regularly, rather than every term in software engineering.

**The central habit:** replace a broad assurance with a specific question about behavior and evidence.

> Instead of: “Everything is perfect now, right?”
>
> Ask: “What behavior did you verify, in which environment, and what remains untested?”

## Contents

1. [The development lifecycle](#1-the-development-lifecycle)
2. [The fifteen distinctions to learn first](#2-the-fifteen-distinctions-to-learn-first)
3. [Turning an idea into a request](#3-turning-an-idea-into-a-request)
4. [Choosing the kind of help you want](#4-choosing-the-kind-of-help-you-want)
5. [The parts of a web application](#5-the-parts-of-a-web-application)
6. [Databases and persistence](#6-databases-and-persistence)
7. [Accounts, authentication, and access](#7-accounts-authentication-and-access)
8. [Git, builds, environments, and deployment](#8-git-builds-environments-and-deployment)
9. [Testing and evidence](#9-testing-and-evidence)
10. [Financial calculations and business rules](#10-financial-calculations-and-business-rules)
11. [Performance and reliability](#11-performance-and-reliability)
12. [UI, UX, and interaction vocabulary](#12-ui-ux-and-interaction-vocabulary)
13. [Debugging and security-review vocabulary](#13-debugging-and-security-review-vocabulary)
14. [Your previous wording, improved](#14-your-previous-wording-improved)
15. [Reusable request patterns](#15-reusable-request-patterns)
16. [Understanding completion reports](#16-understanding-completion-reports)
17. [Practice and a learning sequence](#17-practice-and-a-learning-sequence)
18. [A final self-check before sending](#18-a-final-self-check-before-sending)

## 1. The development lifecycle

These stages can repeat. You do not have to finish the entire product before testing or reviewing security.

| Stage | What happens | A useful question |
|---|---|---|
| Problem discovery | Identify who has a problem and why it matters. | “What user problem would this solve?” |
| Brainstorming / ideation | Generate possible approaches without choosing one yet. | “Compare three approaches and their tradeoffs. Do not implement.” |
| Concept definition | Explain the proposed experience and its boundaries. | “Describe how a seller would use saved commission rates.” |
| Requirements | Specify required behavior, constraints, and exclusions. | “What must be true for this feature to meet the request?” |
| Design | Decide how the experience and system should work. | “Describe the user flow, data flow, and affected components.” |
| Planning | Order the work and identify dependencies. | “What can be done now, and what needs an external input?” |
| Implementation | Change the source code or configuration. | “Implement the agreed behavior within this scope.” |
| Verification | Check the implementation against requirements. | “Show which acceptance criteria passed and how.” |
| Deployment | Put a version of the application into a target environment. | “Which version is deployed, and where?” |
| Release | Make functionality available to intended users. | “Is the deployed feature enabled for users?” |
| Monitoring / maintenance | Observe real operation and address issues over time. | “What evidence would reveal a failure after release?” |

**Example:** “Sellers should not repeatedly enter the same fee” is a problem. “Save a default rate per seller and marketplace” is a proposed solution. “After refresh, the saved rate is still available to that seller” is an acceptance criterion.

Do not automatically turn the first solution into a requirement. You can ask whether a simpler solution meets the same need.

## 2. The fifteen distinctions to learn first

| Terms | The distinction |
|---|---|
| Idea vs requirement | An idea is a possibility. A requirement states behavior the agreed solution must provide. |
| Requirement vs acceptance criterion | A requirement says what is needed. An acceptance criterion makes its satisfaction checkable. |
| Observation vs hypothesis | An observation is what you saw. A hypothesis is a possible explanation. |
| Bug vs enhancement | A bug violates intended behavior. An enhancement adds or changes intended capability. |
| Implemented vs verified | Code exists versus evidence shows particular behavior works under stated conditions. |
| Verified vs deployed | Tested behavior versus a version installed in an environment. Local verification does not identify the live version. |
| Deployed vs released | Installed in an environment versus available to intended users. These may happen together. |
| Connected vs functioning end to end | One connection succeeded versus the complete user workflow succeeded. |
| Authentication vs authorization | Establishing who the user is versus deciding what that user may access or do. |
| Schema vs data | The structure and rules for storage versus the stored records. |
| State vs persistence | A value currently held by the application versus a value stored beyond the current execution. Persistence always has a storage scope and lifetime. |
| Default vs hard-coded value | A default is a starting choice. Hard-coded describes a value embedded in source code. A default can come from saved configuration. |
| Estimate vs actual | A prediction based on assumptions versus a recorded outcome supported by relevant evidence. |
| Passing tests vs complete correctness | Tested cases met their assertions versus the much broader claim that all relevant behavior is correct. |
| General research vs business-specific fact | Research can explain categories and rules. It cannot determine your business's registration, contract, or transaction facts without evidence. |

Keep returning to this table. These distinctions prevent more confusion than memorizing dozens of framework names.

## 3. Turning an idea into a request

### Product vocabulary

| Term | Plain meaning | MarginFlow example |
|---|---|---|
| User / persona | The kind of person using the product; a persona describes relevant needs and circumstances. | A seller managing orders across marketplaces. |
| Use case | A goal someone wants to accomplish. | Save a frequently used commission rate. |
| User journey | A broader sequence of experiences toward a goal. | Discover the app, sign up, onboard, add an order, review profitability. |
| User flow | The steps and decisions in a particular task. | Open Add Order, choose a marketplace, select a rate, save. |
| User story | A short requirement format connecting user, action, and benefit. | “As a seller, I want saved rates so I can enter orders faster.” |
| Functional requirement | A capability the system must provide. | Retrieve saved rates for the signed-in account. |
| Nonfunctional requirement | A quality or operating constraint. | Keep rates isolated between accounts; meet an agreed response-time target. |
| Scope | What this task includes. | Save and load quick commission rates. |
| Out of scope / non-goal | What this task excludes. | No redesign of the order modal. |
| Constraint | A boundary the solution must respect. | Preserve historical order calculations. |
| Dependency | Something the work relies on. | A database migration must be applied before the new endpoint can use its table. |
| Tradeoff | A benefit gained alongside a cost or limitation. | More fee-rule flexibility can make setup harder. |
| MVP | Minimum viable product: a limited product sufficient to test a useful value proposition. | A narrower workflow with explicit limitations, not permission for unreliable behavior. |
| Edge case | A boundary or unusual condition worth considering. | A saved rate is deleted while an order form is open. |
| Acceptance criteria | Observable conditions for accepting the work. | Save 7%, refresh, select it again, and verify account isolation. |
| Definition of done | The team's broader conditions for considering a task complete. | Implementation, required review, relevant checks, and documented blockers. |

### A specification is a set of decisions

A **specification** describes expected behavior precisely enough to implement and evaluate. A **PRD**, or product requirements document, organizes the product problem, users, requirements, and success measures. Small tasks rarely need a large PRD.

For saved rates, decide:

1. Who owns the setting: one user, one company account, or everyone?
2. What it applies to: one marketplace, product, or order?
3. When it applies: immediately, on save, or only to future orders?
4. How long it lasts: this form, this browser, or future sessions and devices?
5. What happens if it is missing or invalid?
6. What evidence will show that it works?

You can ask the assistant to identify undecided questions. You do not have to invent the implementation.

### Separate facts, guesses, and decisions

> **Observation:** The rate disappears after refresh.
>
> **Hypothesis:** It may only be stored in browser memory.
>
> **Requirement:** The saved rate must load again for the same account.
>
> **Unknown:** I do not know whether the save request reached the database.

This is more useful than “the database is broken.” It leaves room to investigate the real cause.

## 4. Choosing the kind of help you want

| Mode | What you are asking for | Example |
|---|---|---|
| Explain | Teach a concept. | “Explain schema versus database records using our order workflow.” |
| Explore | Consider options without choosing or changing anything. | “Compare saved defaults and per-order overrides. Discussion only.” |
| Inspect / audit | Examine the current implementation and report findings. | “Inspect how order edits are saved. Do not modify files.” |
| Diagnose | Investigate the cause of a specific problem. | “Find why the saved profile image disappears after refresh.” |
| Plan | Propose sequenced work and dependencies. | “Create a plan with acceptance criteria and blockers.” |
| Implement | Make the authorized changes. | “Implement the agreed plan, limited to saving and loading.” |
| Verify | Evaluate specific behavior and report evidence. | “Verify save, refresh, re-login, and account isolation.” |
| Guide | Give actions for you to perform. | “Give one step at a time, with the tool, location, and expected result.” |

“What do you think?” works for exploration. When you expect a concrete result, name it: explanation, comparison, diagnosis, plan, implementation, or verification report.

**Separate a question from authorization.** “Would deleting the schema help?” asks for analysis. It should not be interpreted as “delete the schema.” Say explicitly when you want an action.

## 5. The parts of a web application

### The basic map

**Browser interface → network request → server logic → database or external service → response → interface update**

A problem can occur at any step. The browser looking correct does not establish that the database saved the record.

| Term | Meaning |
|---|---|
| Frontend / client | The user-facing application and logic running in the user's browser. |
| Backend / server | Logic running outside the user's browser, commonly handling protected operations and data access. |
| Full stack | Work spanning frontend and backend. |
| Architecture | How system parts are organized, communicate, and divide responsibilities. |
| Component | A reusable unit of interface or application structure. |
| Page / route | A location or request path handled by the application. Routes can serve pages or API responses. |
| Runtime | The environment in which code executes, such as the browser or a server process. |
| Dependency / package | An external library the project uses. The word dependency also applies to tasks that rely on other tasks. |
| Framework | A structured foundation for building applications. |
| Source code | The files developers edit to define the program. |
| Configuration | Settings that control behavior without necessarily changing program logic. |
| Business logic / domain logic | The rules of the business, such as how returns affect recognized revenue. |

### Recognizing your stack's names

These names identify tools, not proof of quality:

| Name | Role in plain language |
|---|---|
| JavaScript | A programming language used in browsers and server environments. |
| TypeScript | JavaScript with a type system and tooling that can catch certain mistakes before execution. It does not automatically validate incoming runtime data. |
| React | A library used to compose interfaces from components. |
| Next.js | A framework built around React that supports web pages and server-side capabilities. |
| Node.js | A runtime for executing JavaScript outside the browser. |
| npm | A package manager and a way to run configured project scripts. |
| Tailwind CSS | Utilities for styling interfaces. |
| PostgreSQL / Postgres | A database management system. |
| SQL | A language used to define and query relational databases. |
| Supabase | A platform providing services including hosted Postgres and authentication. Those services still need appropriate application configuration. |
| Vercel | A platform used to build and host applications. Hosting the application does not automatically host every external service it depends on. |

### APIs and requests

An **API** is an interface through which software interacts with other software. A web API commonly uses network requests and responses.

| Term | Meaning | Example |
|---|---|---|
| Endpoint | A particular API destination/operation, often identified by method and path. | A request to retrieve an account's saved fee rates. |
| Request | A message asking a server to do something. | Save this order. |
| Response | The server's reply. | Saved order details, or an error. |
| Payload / request body | The data sent with a request. | Marketplace, order lines, and rate selection. |
| Header | Metadata accompanying a request or response. | Content type or authentication information. |
| JSON | A common text format for structured data. | A response containing an order ID and status. |
| HTTP method | The operation category used by an HTTP request. | GET retrieves; POST commonly submits/creates; PATCH commonly partially updates; PUT commonly replaces; DELETE requests removal. Exact behavior depends on the API contract. |
| Status code | A numeric description of the HTTP result. | 2xx success; 4xx request/auth/access problems; 5xx server-side failures. |
| API contract | Agreed inputs, outputs, behavior, and error conditions. | Required fields and the response when a rate is invalid. |
| Integration | A connection between systems that supports some workflow. | Importing orders from a marketplace. |
| Webhook | A service notifying another system about an event through a request. | A marketplace notifying the app about an order update. |

**CRUD** means Create, Read, Update, Delete. It describes data operations, not a guarantee that every button or workflow has been tested. Deletion may be soft deletion, permanent deletion, or another defined behavior.

Common HTTP responses worth recognizing: **400** means a bad request; **401** commonly indicates missing or invalid authentication credentials; **403** means the server refuses the operation; **404** means the requested resource was not found or is not being disclosed; **409** signals a conflict with current state; **429** means too many requests; **500** is a general server error. The response details and application behavior still need investigation.

**Validation** checks whether data satisfies specified rules. **Sanitization** transforms or removes content for a particular purpose. **Encoding/escaping** represents content appropriately for an output context. These are different operations; “validate everything” does not specify all necessary handling.

**CORS**, or cross-origin resource sharing, is a browser mechanism controlling when a page can read responses from another origin. A cross-origin error needs investigation of the actual request and configuration; it does not by itself establish that the password is wrong. CORS is not a substitute for server-side access control.

Useful question: “Does this control update browser state only, or does it call an endpoint that persists the change?”

## 6. Databases and persistence

### Structure is different from content

| Term | Meaning | Example |
|---|---|---|
| Database | An organized store of data managed by a database system. | The application's business records. |
| Schema | Often means the structure of tables and rules. In Postgres, it also specifically means a namespace grouping database objects. Clarify which meaning is intended. | The order table design; or the Postgres `public` namespace. |
| Table | A structured collection of rows. | Orders. |
| Row / record | One stored entry. | One order. |
| Column / field | One attribute of a record. | Order date. “Field” can also mean a form input. |
| Data type | The kind of value a field stores. | Date, text, integer, or decimal. |
| Primary key | A value or set of values uniquely identifying a row. | An order ID. |
| Foreign key | A constraint connecting records through referenced keys. | An order line referencing its parent order. |
| Constraint | A database-enforced rule. | A required value or a uniqueness rule. |
| Index | A structure that can speed up suitable queries, with storage and write costs. | An index supporting order searches by account and date. |
| Query | An instruction to retrieve or manipulate database data. | Retrieve this account's orders. |
| Transaction | A group of database operations committed together or rolled back together. | Save the order header and its lines as one unit. |
| Migration | A versioned change to database structure or data. | Add a table for saved rates. Creating the migration file does not apply it. |
| Seed data | Initial or sample records loaded for a purpose. | Test marketplaces or development examples. |
| Metadata | Data describing other data or system objects. It is not a synonym for fake data. | Import source, creation timestamp, or column definitions. |
| Fixture | A controlled input or setup used in testing. | A sample order with known line amounts. |
| Backup | A stored copy intended to support recovery. | A database backup taken before a migration. |
| Restore | Recover data or a database from a backup. | Restore a backup into a separate test environment. |

**Important correction from your chats:** if numbers are invented for testing, call them **sample data**, **dummy data**, or **synthetic test data**. Calling them metadata hides the actual distinction.

Sample data can still test real calculations when the expected outputs are independently known.

**Soft delete** marks a record as deleted while retaining it under defined rules. **Hard delete** removes the record from the active database; backups or other copies may still exist. **Drop a schema/table** removes database objects, with effects depending on the command and dependencies. **Truncate** removes table rows through a database operation with its own restrictions and effects. **Reset** has no single universal meaning. Ask exactly which objects or records an operation changes before authorizing it.

### Where can a value live?

| Storage location | Typical scope | What a successful check establishes |
|---|---|---|
| In-memory UI state | The current running interface | The visible value changed during this execution. |
| Browser local storage | A particular browser profile and origin | It can survive refresh locally; this alone establishes neither cross-device access nor suitable account isolation. |
| Database | The records stored by the configured database | Persistence can support later sessions/devices, subject to correct saving, loading, access rules, and retention. |
| Cache | A reusable copy, often temporary | A value can be retrieved quickly; freshness and invalidation need defined behavior. |

**Persistence** means retaining data beyond the current execution. Always ask where, for whom, and for how long. “Permanent” is usually too vague.

**Synchronization** means keeping copies or systems aligned. A successful local save does not automatically mean another device already has the update.

**Source of truth** means the designated authority for a particular fact. Specify the fact: saved rate configuration, order input, or actual settlement deduction may have different authoritative sources.

### Connected does not mean complete

Distinguish these claims:

1. The application reached the database server.
2. It authenticated using the configured database credentials.
3. The required tables and migration versions exist.
4. The application can perform the required reads and writes.
5. Writes survive refresh and re-login.
6. Different accounts cannot access one another's records.
7. Failure and recovery behavior have been checked.

Evidence for one claim does not automatically establish the rest.

### Defaults, saved settings, and overrides

- **Hard-coded:** embedded in source code.
- **Default:** used as a starting choice or when an applicable value is absent.
- **Configurable:** adjustable through a supported configuration mechanism.
- **User-configurable:** adjustable by the relevant user, within allowed boundaries.
- **Override:** a more specific choice taking precedence over another setting.
- **Precedence:** the order used to choose among applicable settings.
- **Snapshot:** a record of values at a particular moment, useful when later configuration changes should not rewrite history.

**Dynamic** only means behavior or content changes in response to something. Name that input: account, selected marketplace, current data, or saved configuration. It does not automatically mean persistent, personalized, or correct. Hard-coded values are not inherently mistakes: fixed conversion constants and deliberately fixed rules can belong in code. The issue is embedding a changeable business assumption where configuration or evidence is required.

Better than “make the fees dynamic”: “Load a saved account-and-marketplace default, allow a per-order override, and preserve the inputs used for past orders.”

## 7. Accounts, authentication, and access

### Identity, access, and onboarding are separate

| Term | Meaning |
|---|---|
| Sign up | Create an account or begin account registration. |
| Sign in / login | Establish an authenticated session for an account. |
| Authentication | Establish identity using the chosen mechanism. |
| Authorization | Decide whether that identity may perform an operation on a resource. |
| Email verification | Confirm control of an email address through a verification process. It does not establish every other fact about the person. |
| Session | The application's mechanism for recognizing an authenticated user across requests. |
| Cookie | Browser-managed data sent with matching requests according to its attributes. Cookies are often used in session systems. |
| Token | A value used in a protocol to represent a claim, grant, or other state. Its permissions and lifetime depend on its type and system. |
| JWT | JSON Web Token: a format for carrying claims. Common signed JWT payloads are readable; the format alone does not encrypt their contents or make unverified claims trustworthy. |
| OAuth / OpenID Connect | OAuth is an authorization framework; OpenID Connect adds an identity layer. “Sign in with Google” commonly uses these protocols. |
| Callback | A destination or handler invoked when another operation completes or returns control. |
| Redirect | An instruction or action sending the browser to another address. |
| Onboarding | Collecting initial information or guiding a user after account creation/sign-in. |
| Tenant | A customer/account boundary in a shared system. Depending on the design, one tenant can contain several users. |
| Tenant isolation | Preventing access across those customer/account boundaries. |
| RLS | Row-level security: database policies controlling access to rows. Its effect depends on roles, policies, and the path used to access the database. |

**Authentication working does not prove authorization works.** A user can log in successfully while an unrelated endpoint still has an access-control flaw.

**Onboarding complete does not mean email verification was displayed correctly.** They are different parts of the flow.

**Your app's email/password login is not necessarily your Gmail login.** An email address can identify an app account with its own password. Using that address does not make Google's password the app password. Google sign-in is a separate flow.

Ask about the complete journey:

> “For a new account, verify email confirmation, the return destination, onboarding, and dashboard access. For an existing account, verify sign-in without repeating completed onboarding.”

### Configuration and credentials

| Term | Meaning |
|---|---|
| Environment variable | A value supplied to a process or build through its environment. It is not automatically secret. |
| Secret / credential | A sensitive value that grants access or proves identity. |
| Public configuration | Information intended to be visible, such as a public site address. |
| Connection string | A structured address and parameters used to connect to a service; it may include credentials. |
| API key | A value used to identify or authorize an API caller. Whether it is secret depends on the key's intended role and permissions. |
| Secret rotation | Replace a credential and retire the old one. |

Do not include actual passwords, private keys, or secret-bearing connection strings in a question. A placeholder plus the exact error is usually enough to discuss configuration. If a sensitive value is required for an authorized action, use the intended secure configuration mechanism.

“Do not leak this password” is not a substitute for controlling where the password is supplied. This is a communication boundary to practice, not a request to change any credentials now.

## 8. Git, builds, environments, and deployment

### Your working files are not automatically the live application

**Edit → commit → push → build/deploy → verify the target environment** is one common workflow. Teams and platforms may order or automate parts differently.

| Term | Meaning | What it does not establish |
|---|---|---|
| Repository / repo | Version-controlled project history and files. | That every local file is committed. |
| Working tree | The current files in a checkout, including local edits. | That those changes exist remotely. |
| Diff | The changes between two versions or states. | That the changes are correct. |
| Commit | A recorded snapshot/change in Git history. | That it was pushed or deployed. |
| Branch | A named line of development. | That it uses a separate running environment. |
| Push | Send Git objects/references to a remote repository. | That a deployment succeeded. |
| Pull request / PR | A proposed change for discussion/review and merging. | That it was merged or released. |
| Merge | Combine development histories/changes. | That the result was tested in production. |
| Dependency installation | Install the packages the project needs. | That the application builds or runs correctly. |
| Build | Transform/check/package source into an application artifact, according to the project's tooling. | That every user flow works or that all tests ran. |
| Type check | Check consistency against TypeScript's static rules. | That runtime inputs and business calculations are correct. |
| Deployment | Install or make a version available in a target environment. | That its dependencies and user journeys are working. |
| Release | Make functionality available to intended users. | That monitoring and recovery have been exercised. |
| Rollback | Return to a prior state/version through a defined mechanism. | That database changes or external side effects are automatically undone. |
| CI / CD | Automation for integrating changes and delivering/deploying versions. Exact checks depend on the pipeline. | That an unspecified check was included. |

### Environment vocabulary

| Environment | Purpose |
|---|---|
| Local development | Run on a developer's machine. |
| Test environment | Run particular automated/manual tests with controlled setup. |
| Preview environment | Inspect a proposed version before broader release. |
| Staging | Exercise release behavior in an environment intended to resemble production. |
| Production | Serve the intended real users and operational data. |

These names are conventions, not guarantees of isolation. Ask which database, identity provider, and other services each environment actually uses.

**Localhost** means the device making the connection. On your phone, `localhost` means your phone, not your laptop. Accessing a laptop's development server from a phone involves a reachable network address and suitable configuration.

**Development server** means a process optimized for development. Its compilation and timing behavior can differ from a production build.

**Build-time error** occurs while preparing the application. **Runtime error** occurs while executing it. **Warning** reports a condition that may allow the current operation to continue; assess the actual warning rather than treating all warnings as failures or as harmless. **Deprecated** means a feature or interface is discouraged or being phased out, not necessarily that it has already stopped working.

**Configuration can be read at build time or runtime.** Whether changing a variable requires a new build depends on how the application/platform uses it. Ask rather than assuming.

### URLs and hosting

- **Domain / hostname:** the named destination, such as `app.example.com`.
- **Path:** the resource location after the hostname, such as `/login`.
- **Query string:** parameters after `?`, such as an error identifier. It can contain sensitive values, so share selectively.
- **Origin:** the combination of scheme, hostname, and port used by browser security rules.
- **DNS:** the system mapping domain names to relevant network records.
- **Deployment URL:** an address associated with a deployed version/environment; behavior depends on the hosting setup.
- **Redirect URI / callback URL:** the return destination configured for an authentication or integration flow.

Do not use “URL,” “domain,” and “callback” interchangeably. Describe the part that changed and the action that triggered it.

### Three different caches

| Cache | What it commonly holds |
|---|---|
| Build cache | Reusable work from earlier builds. |
| Browser / HTTP cache | Previously fetched resources or responses, subject to caching rules. |
| Application / data cache | Reusable computed or retrieved values inside an application/system. |

“Clear the cache” is incomplete. Ask which cache, what evidence implicates it, and what result would test that explanation.

## 9. Testing and evidence

### Types of checks

| Check | What it examines | Its limit |
|---|---|---|
| Unit test | A small piece of logic in a controlled setup. | Does not alone prove database or browser behavior. |
| Integration test | Interaction between selected components/services. | Covers only the integrations and setup exercised. |
| Contract test | Whether an interface follows agreed expectations. | Does not by itself prove the whole workflow. |
| End-to-end / E2E test | A workflow across a substantial path through the system. | Still depends on which services are real, which are simulated, and which cases are covered. |
| Smoke test | A small set of basic checks for major breakage. | Broad but shallow. |
| Regression test | A check guarding against previously working behavior breaking. | This describes its purpose; it may be a unit, integration, or E2E test. |
| UAT | User acceptance testing against real user needs and acceptance criteria. | Does not substitute for all technical or security checks. |
| Manual test | A person performs and evaluates the check. | Repetition and coverage depend on the procedure. |
| Static analysis / linting | Inspect code without exercising the full application. | Cannot establish every runtime behavior. |

**Mock / stub:** a controlled substitute for part of a system. Terminology varies, but the important question is what was replaced. A fake marketplace response can test parsing; it does not verify live marketplace credentials or permissions.

**Assertion:** the condition a test checks.

**Verification** checks conformity to specified requirements. **Product validation** asks whether the solution meets the user's actual need. This is a different use of “validation” from checking form inputs. A feature can satisfy its specification but still be too cumbersome for the intended user.

**Coverage:** a measure of what a test suite exercised, such as lines or branches. High code coverage does not prove that the business expectations were correct or complete.

### Status words you should request

| Status | Meaning |
|---|---|
| Passed | The executed check met its defined expectation. |
| Failed | The executed check did not meet its expectation. |
| Not run | No result exists from this run. |
| Blocked | A necessary dependency prevents the check/work from proceeding. |
| Skipped | The check was deliberately not executed; the reason should be stated. |
| Inconclusive | The available evidence does not support a clear result. |
| Partially complete | Some explicitly listed parts are complete; others remain. |

Do not add “not run,” “blocked,” or “skipped” to the passed total.

### Ask what a test result actually supports

> “Give the test scope, environment, real versus simulated dependencies, result, and remaining limits.”

These are different statements:

- “The calculation function returned the expected amount.”
- “The API saved that amount in the test database.”
- “The browser loaded it again after re-login.”
- “The deployed application did this using the production configuration.”

A build passing does not imply the test suite ran. A large passing test count does not identify which of these statements was checked.

## 10. Financial calculations and business rules

### Three layers of correctness

1. **Implementation correctness:** the code performs the specified formula.
2. **Business-rule correctness:** the formula and its conditions match the intended business policy.
3. **Input/evidence correctness:** the actual inputs and supporting records justify using that rule.

A calculation can be implemented correctly while the chosen rate or tax assumption is wrong.

| Term | Meaning | Example |
|---|---|---|
| Formula | A defined mathematical relationship. | Fee = eligible base × rate. |
| Calculation base | The amount to which a rate applies. | Discounted item value excluding item tax, if that is the specified policy. |
| Business rule | A policy deciding how values or events should be treated. | Whether shipping revenue is refunded on a particular return. |
| Assumption | A proposition currently treated as true without complete confirmation. | Assuming a sample settlement contains every deduction. |
| Accuracy | Agreement with the appropriate correct/reference result. | An output can contain many decimal places and still be inaccurate. |
| Precision | The representable/calculated level of detail. | Amounts represented to subunit precision. |
| Rounding policy | The rule for rounding, including when rounding occurs. | Round each line, or round the final total; these may differ. |
| Deterministic | The same inputs and relevant configuration produce the same result. | A calculation using a recorded rule version. |
| Invariant | A condition required to remain true. | Debits equal credits for a balanced journal entry. |
| Reconciliation | Compare records/sources and explain differences. | Compare estimated deductions with the settlement statement. |
| Audit trail | A record supporting reconstruction of changes or decisions. | Who changed a fee rule and which version an order used. |
| Provenance | Where a value came from. | Imported statement, manual entry, or estimate. |
| Estimate | A predicted value based on inputs and assumptions. | Expected marketplace fee. |
| Actual | A recorded outcome supported by an appropriate source. | A deduction on a settlement statement, still subject to source quality and corrections. |
| Unknown vs zero | Missing/unresolved information versus a known numeric amount of zero. | No fee rule is different from an explicitly applicable 0% rate. |
| Golden case / reference case | An example with an independently established expected result. | A manually reviewed invoice and its expected calculation. |

**Minor units** are currency subunits, such as paise for rupees. **Basis points** express rates: 100 basis points = one percentage point, so 7% = 700 basis points. These representations can help implement explicit arithmetic, but neither automatically establishes the correct business policy.

### Financial words that should not be interchangeable

| Terms | Difference to keep clear |
|---|---|
| Revenue vs profit | Revenue describes recognized income under the chosen accounting rules. Profit also accounts for relevant costs and expenses. |
| Revenue vs cash received | Recognition of income and receipt of money can occur at different times. |
| Commission vs total deductions | Commission is one charge type. A settlement can contain additional charges and adjustments. |
| Settlement vs estimate | Settlement records the marketplace/payment-provider accounting of amounts due or paid; an estimate predicts an amount. Verify exactly what a particular settlement field represents. |
| Return vs refund | A product-return event and a money-refund event are related but separate. One does not automatically establish every consequence of the other. |
| RTO vs customer return | Return to origin commonly concerns an undelivered shipment going back; a customer return concerns goods returned after delivery. Exact provider statuses and policies must be mapped explicitly. |
| Ledger vs dashboard | A ledger records accounting entries. A dashboard presents selected metrics. Their totals should only be compared after aligning definitions, scope, and dates. |
| Cash basis vs accrual basis | Broadly, recording around cash movement versus recognition when income is earned/expenses incurred under applicable rules. Neither label alone specifies every calculation. |

These are vocabulary distinctions, not a determination of the accounting or tax policy your business must use. State the metric's definition, date basis, and included components before comparing figures.

### An improved calculation question

> “For this sample order, show the input amounts, calculation base, applicable rule, rounding steps, and expected output. Compare the code output with an independently derived result. List assumptions that remain unresolved.”

The expected output should not be obtained by copying the same implementation into the test. Otherwise the implementation and test may share the same mistake.

**Research cannot establish your private business facts.** It can explain registration categories or marketplace policies. Your actual registration, contract terms, invoices, and transaction evidence must come from the appropriate records or responsible person.

If you do not know a fact, say: “Explain how I can identify it. Keep it unresolved until there is evidence.”

## 11. Performance and reliability

“Optimize” means improve a measured quality within constraints. First identify the behavior that is slow or unreliable.

| Term | Meaning |
|---|---|
| Latency | Time taken for a particular operation to respond. Specify what starts and ends the measurement. |
| Response time | A measured request/operation duration; clarify which network and processing parts are included. |
| Throughput | Amount of work completed per unit of time. |
| Bottleneck | A limiting part of a particular workload. |
| Profiling | Measuring where time or resources are spent. |
| Cold start / warm execution | An operation with initialization/setup versus one with reusable initialized resources. Exact behavior depends on the platform. |
| p95 latency | A duration at or below which approximately 95% of measured operations fall. The measurement window and sample matter. |
| Frame rate / frame time | How often visual frames are produced / time taken per frame. Relevant to animation smoothness. |
| Jank / stutter | Noticeably uneven visual updates or interaction. |
| Debounce | Wait for a quiet interval before performing an action, such as searching after typing pauses. |
| Throttle | Limit how frequently an action runs. |
| Polling | Repeatedly request updates on a schedule. |
| Timeout | Stop waiting after a defined period. |
| Retry | Attempt an operation again after a failure. |
| Idempotency | Repeating an operation has the same intended effect as performing it once; important when retries could otherwise duplicate a payment or import. |
| Optimistic update | Show a proposed UI change before server confirmation, with defined failure handling. |
| Reliability | Ability to perform required behavior under stated conditions over time. |

**Request latency and animation smoothness are separate.** A fast API can coexist with a stuttering animation. A smooth loading indicator can coexist with a slow request.

**One timing is a clue, not a baseline.** Compare repeated measurements under specified conditions. A development request that includes first-time compilation is different from a warm production request.

Better than “reduce all API timings”:

> “The dashboard request is slow after sign-in. Measure its timing in the deployed environment, separate database time from other processing, and identify the main bottleneck. Preserve the data returned.”

If you do not know a reasonable target, ask for measurement first and a justified target second.

## 12. UI, UX, and interaction vocabulary

**UI** is the interface: controls, layout, visual treatment. **UX** is the broader experience of completing a task, including clarity, feedback, effort, accessibility, and error recovery.

| Term | Meaning | Useful wording |
|---|---|---|
| Layout | Arrangement and sizing of elements. | “Widen the marketplace selector within the existing row.” |
| Spacing / padding / margin | Distance between elements / inside a boundary / outside a boundary. | “Add a small top padding on mobile only.” |
| Typography | Font, size, weight, line height, and related text treatment. | “Use the existing body-text style.” |
| Contrast | Visual difference making content distinguishable. | “Increase text contrast against this background.” |
| Responsive design / breakpoint | Layout adapting to available space / a threshold for changing presentation. | “Apply this to the mobile layout; preserve desktop.” |
| Component state | A control's current condition. | Default, hover, focus, active, selected, disabled, loading, or error. |
| Hover | Pointer rests over an element. | “Show the label when the pointer is over the collapsed sidebar icon.” |
| Focus | The element currently targeted for keyboard/input interaction. | “Make the label available on keyboard focus too.” |
| Active / selected | A current interaction state or chosen item; exact meaning depends on the control. | “Highlight only the current navigation section.” |
| Tooltip | A short supplemental label tied to an element. | The name of an otherwise unlabeled icon. |
| Popover | An anchored floating container with additional content or controls. | A small account menu. |
| Dropdown / select | A control exposing choices; native selects and custom menus have different behaviors. | A marketplace selector. |
| Modal / dialog | A focused interaction layer requiring attention before returning to surrounding content. | Add Order dialog. |
| Backdrop | The layer behind a dialog. | The tinted area outside the card. |
| Drawer / sheet | A panel usually entering from an edge. | A mobile navigation panel. |
| Toast | A brief status notification. | “Changes saved.” |
| Inline validation | Feedback near the affected input. | An invalid phone-number message below that field. |
| Empty state | What appears when there is no data to show. | No orders yet. |
| Loading state | Feedback while work is in progress. | Only the submitted sign-in method shows processing. |
| Overflow / clipping | Content extends outside a boundary / is cut off by it. | A marketplace menu extends beyond the dialog. |
| Transition / animation | Visual change between states / movement or change over time. | Theme switching without abrupt flashes. |
| Accessibility / a11y | Making functionality usable across abilities, devices, and assistive technologies. | Keyboard operation, labels, contrast, and meaningful feedback. |

Do not force yourself to identify the exact component name. “The floating label next to the icon” plus a screenshot can be precise enough.

**Screenshots are evidence; a sentence supplies the question.** For example: “This is after I pressed Save. The old image is still visible. Is the save failing, or is the displayed image stale?”

On touch devices, hover-only information may be unavailable. Describe the intended behavior for each relevant input method rather than assuming a desktop interaction works everywhere.

## 13. Debugging and security-review vocabulary

### Reporting a bug

| Term | Meaning |
|---|---|
| Reproduction steps / repro | The actions needed to make the issue occur. |
| Expected behavior | What should happen according to the intended requirement. |
| Actual behavior | What you observed. |
| Environment | Relevant device, browser, app version, configuration, and data setup. |
| Root cause | The underlying reason for the failure. |
| Symptom | The visible effect of the failure. |
| Workaround | A temporary way to proceed without resolving the underlying cause. |
| Fix / remediation | A change addressing the problem. |
| Regression | Previously working behavior that breaks after a change. |
| Logs | Recorded events that can help reconstruct what happened. They are not automatically complete or safe to share unfiltered. |
| Stack trace | A diagnostic record of the execution path associated with an error. |
| Observability | Ability to understand internal behavior from outputs such as logs, metrics, and traces. |

“It doesn't work” can start the conversation, but add: action, result, expectation, environment, and any exact error. Do not invent a cause to make the report sound technical.

### Discussing security findings

| Term | Meaning |
|---|---|
| Threat model | Identify what matters, who/what could threaten it, and plausible failure/attack paths. |
| Asset | Something to protect, such as customer records or credentials. |
| Attack surface | The parts exposed to potential misuse. |
| Vulnerability | A weakness that can enable a security impact under relevant conditions. |
| Risk | A judgment about potential harm and its likelihood/conditions. |
| Severity | The assessed seriousness of a finding. |
| Priority | When to address it, considering severity plus exposure, dependencies, and business needs. |
| Mitigation | A measure reducing risk, possibly without removing the entire cause. |
| False positive | A reported issue that is not valid under the relevant facts. |
| False negative | A real issue that the check failed to detect. |
| Least privilege | Give identities only the permissions needed for their purpose. |
| Security regression test | A check intended to prevent a known security failure from returning. |

Use terms such as **cross-account data access**, **credential exposure**, or **missing access checks** when they match the evidence. “Data leak” describes an outcome; the investigation should identify the mechanism and affected data.

**No scanner findings** means that scanner did not report findings under that run's conditions. It does not establish that the system has no vulnerabilities.

Better than “check everything for leaks”:

> “Review the order APIs for cross-account access and credential exposure. For each finding, show the affected path, evidence, impact, proposed fix, and a verification method. State unreviewed areas.”

## 14. Your previous wording, improved

These examples describe recurring patterns. Informal wording is allowed; the improved versions make the request easier to evaluate.

| Instead of this pattern | Try this | Why it helps |
|---|---|---|
| “Make everything 100% accurate.” | “Verify these workflows against explicit rules and reference cases. List unresolved assumptions.” | Defines evidence and leaves uncertainty visible. |
| “Everything passed, right?” | “List passed, failed, blocked, skipped, and not-run checks separately.” | Avoids turning a partial result into a blanket success. |
| “Is the database connected?” when you mean the whole feature | “Verify connection, required migrations, authenticated CRUD, persistence, and account isolation. Report each separately.” | Names the claims you actually care about. |
| “Make the fees dynamic.” | “Save defaults per account and marketplace, load them in future sessions, and allow a per-order override.” | Defines ownership, persistence, and precedence. |
| “Save it permanently.” | “Store it in the database and load it after refresh and re-login. Specify how later edits affect existing orders.” | Replaces an ambiguous lifetime with observable behavior. |
| “Optimize everything.” | “Measure the slow dashboard interaction, identify its bottleneck, and improve it without changing results.” | Creates a bounded performance task. |
| “It feels like the whole page reloads.” | “Switching mobile sections causes a visible flash/stutter. Check whether navigation reloads the document or remounts large UI sections.” | Keeps the observation separate from a possible cause. |
| “Make it production ready.” | “Identify the remaining release blockers, evidence required, and environment-specific checks.” | Turns a broad goal into a reviewable readiness assessment. |
| “I hope you understood.” | “Before implementing, summarize the behavior and highlight undecided requirements.” | Uses a concrete check when the task warrants one. |
| “Give your thousand percent; don't make mistakes.” | “Verify each acceptance criterion and report failures or limits without marking them complete.” | Requests a process and evidence instead of intensity. |
| “Fix this once and for all.” | “Find the root cause, fix it, and add a relevant regression check.” | States an achievable engineering action. |
| “These numbers are metadata.” | “These are synthetic test records. Check the formula against independently expected results.” | Corrects the data-category confusion. |
| “Research which tax category applies to my business.” | “Explain how I can identify my category and which evidence is needed. Do not assume the answer.” | Separates general knowledge from private facts. |
| “Now move to the next phase.” | “Move to phase 3; keep phase 2's unresolved items open with their blockers.” | Progress does not erase incomplete acceptance. |
| “The code is on GitHub, so it's live?” | “Which commit is deployed, to which environment, and did that deployment succeed?” | Separates source publication from deployment. |
| “Clear the cache.” | “Identify which cache may be stale and what evidence supports clearing it.” | Avoids an unexplained troubleshooting ritual. |
| “Here is my password; don't leak it.” | “I configured the credential through the intended secure mechanism. Here is the redacted error.” | Preserves useful diagnostic context without pasting the secret. |
| A screenshot with “now?” | “I saved the redirect setting and refreshed. Does this screenshot match the expected state for the next step?” | Makes your action and uncertainty explicit. |
| “You already have all the context.” | “Use the earlier plan; the new fact is that the production database is now reachable. Verify current state before relying on older results.” | Identifies what changed and avoids stale assumptions. |
| “Delete the useless database/files.” | “Identify unused resources and their dependencies first. Show the proposed deletions and reasons before removing them.” | Makes a potentially destructive request concrete and reviewable. |
| Several changes of mind inside one message | “Final decision: phone numbers must contain exactly 10 digits for the currently supported India-only flow. Do not add a country selector.” | Distinguishes the decision from discarded ideas. |

### Phrases you do not need to ban

“I don't know,” “I think,” “what do you recommend?”, and “can you explain?” are useful when they accurately represent uncertainty.

“Next step?” is also fine in a clearly established guided procedure. It becomes weak when several unfinished tasks exist and the intended next step is ambiguous.

You do not need an acceptance-criteria document for changing one label. Scale the structure to the complexity and risk.

## 15. Reusable request patterns

Use the pieces you need. These are learning examples, not commands for the current project.

### A. Brainstorm an idea

> Problem: sellers repeatedly enter the same commission rates.
>
> Explore two or three solutions. Compare user effort, implementation complexity, and limitations. Recommend the smallest useful approach. Discussion only; do not change files.

### B. Ask for an explanation

> Explain the difference between authentication and authorization using our order workflow. Start with plain language, then introduce the technical terms. Give one example where login works but access control is wrong.

### C. Inspect before deciding

> Inspect how saved rates currently work. Identify where values are stored, how they are loaded, and which account owns them. Separate observed code behavior from assumptions. Do not implement changes.

### D. Report a bug

> Environment: mobile browser, deployed app.
>
> Steps: sign in, open profile, select a new picture, press Save, refresh.
>
> Actual: the old picture returns.
>
> Expected: the selected picture remains after refresh.
>
> Diagnose the cause. Preserve the existing layout. If the cause is not established, explain the next check rather than guessing.

### E. Request implementation

> Implement saved quick rates for the signed-in account and selected marketplace.
>
> Scope: saving, retrieving, and selecting rates. Preserve other order behavior.
>
> Acceptance: save 7%, refresh, re-login, and confirm it remains available to the same account and unavailable to another account. List any checks that cannot be run.

### F. Request guided setup

> Guide me one step at a time. For each step, name the application or terminal, exact location, action, purpose, and expected result. Distinguish text I should enter from output I should expect. If the interface differs, use the visible evidence before giving the next instruction.

This addresses the earlier confusion about where to run something that was actually an example response.

### G. Request a calculation review

> Review this calculation using the stated business policy and reference inputs. Show the base, rate, rounding, intermediate values, and output. Distinguish implementation errors from missing business facts. Do not infer unknown tax or seller-contract details.

### H. Request progress and readiness

> For each agreed task, report implementation status, verification evidence, environment, and remaining blocker. Distinguish implemented, verified locally, deployed, and verified in the target environment. Do not collapse them into one “done” label.

### I. Change direction explicitly

> Pause the database task without marking it complete. This request is only about the mobile sidebar. After this task, report the database items that remain open.

## 16. Understanding completion reports

### What words should make you ask a follow-up?

| Report says | Ask |
|---|---|
| “Fixed.” | “What behavior changed, and how was it verified?” |
| “Build passed.” | “Which functional checks also ran?” |
| “All tests passed.” | “Which suite, in which environment, with what excluded or simulated?” |
| “Database verified.” | “Connection only, or migrations, CRUD, persistence, and isolation too?” |
| “Migration ready.” | “Was the file created, applied, or applied and verified? To which database?” |
| “Production ready.” | “Which release criteria support that claim, and what remains outside the evidence?” |
| “No vulnerabilities.” | “Which review/checks were performed, and what did they not cover?” |
| “Blocked.” | “What exact input is missing, what does it prevent, and what can continue independently?” |

### A useful completion report has five parts

1. **Change:** what was implemented or examined.
2. **Evidence:** what check ran and what it established.
3. **Environment/version:** where it ran and which version it covered.
4. **Limits:** failures, missing inputs, simulated services, or untested paths.
5. **Next dependency:** what is required for the next meaningful claim.

Track implementation and verification separately. A feature might be implemented, pass local tests, have an unapplied production migration, and have no live acceptance evidence. These states can all be true simultaneously.

### Your role and the assistant's role

Your role is to communicate the goal, relevant business facts, observations, boundaries, and decisions you own. It is reasonable to ask for explanations when these are unclear.

The assistant's role is to investigate, identify missing decisions, explain tradeoffs, respect scope, and substantiate claims. You do not become responsible for an assistant's unsupported assurance merely because your wording was informal.

Do not accept jargon as evidence. Ask for a plain-language explanation whenever a term conceals what actually happened.

## 17. Practice and a learning sequence

### A self-paced sequence

Spend about 15–20 minutes per session. Revisit any session rather than rushing through every term.

| Session | Read | Practice |
|---|---|---|
| 1 | Sections 1–4 | Turn one idea into a problem, requirement, and acceptance criterion. |
| 2 | Section 5 | Describe the path from pressing Save to seeing a database-backed result. |
| 3 | Section 6 | Explain schema, data, migration, persistence, and account scope in your own words. |
| 4 | Section 7 | Explain why successful login does not prove account isolation. |
| 5 | Section 8 | Explain why committed, pushed, built, and deployed are different states. |
| 6 | Sections 9–10 | Explain what one passing calculation test establishes and what it leaves unknown. |
| 7 | Sections 11–13 | Write one performance report and one reproducible bug report. |
| 8 | Sections 14–16 | Rewrite three older requests and evaluate a sample completion report. |

### Exercises

**1. Saved rate:** A rate changes on screen, but disappears after refresh. Can you conclude that it was saved in the database?

**2. Deployment:** The fix was committed and pushed. Can you conclude that users have it?

**3. Login:** Two accounts can sign in. Does this establish that account A cannot read account B's orders?

**4. Calculations:** A 10% fee calculation returns the expected value for one sample order. What additional questions should you ask?

**5. Performance:** One request took several seconds in development. What should you establish before requesting a site-wide optimization?

**6. Workflow:** Clicking a confirmation email produces an error page, but manually signing in works. Is the complete verification experience working?

**7. Status:** A report says 40 passed, 2 failed, and 3 blocked. How should you summarize it?

**8. Policy:** You do not know whether a business-specific tax condition applies. What can research answer, and what requires business evidence?

**9. Scope:** You want dark-mode navigation to match the existing light-mode behavior. Write the scope in one sentence.

**10. Guided setup:** The assistant shows an example response saying the database is healthy. You do not know where to enter it. What should you ask?

### Suggested answers

1. No. The visible state changed. Check the save request, database write, and reload path before identifying the cause.
2. No. Identify the successful deployment and its version, then verify the affected behavior there.
3. No. Verify authorization using separate accounts and relevant operations.
4. Ask about the correct calculation base, other relevant rates, rounding, boundary cases, missing inputs, and whether saving/loading preserves the result. Choose cases based on actual requirements.
5. Identify the action, environment, repeated timing, whether initialization/compilation is included, and where time is spent.
6. No. Successful manual sign-in and a correct confirmation return flow are separate claims.
7. “40 checks passed; 2 failed; 3 could not run because of stated blockers.” Do not summarize this as all passed.
8. Research can explain applicable categories and what evidence distinguishes them. Business records or a responsible expert must establish the actual facts.
9. “Change the dark-mode sidebar only so its item backgrounds and selected-state behavior match the light-mode sidebar; preserve other layouts and behavior.”
10. “Is this text an instruction to enter, or the expected output? Tell me the exact action and tool that produces it.”

### Teach-back practice

After learning a term, explain it without using the term itself. Then give an example and a counterexample.

Example: “Persistence means a saved rate is available in a later session from the intended storage. Seeing it change before refresh does not establish that.”

If you can explain the difference in ordinary language, you understand more than someone who only recognizes the vocabulary.

## 18. A final self-check before sending

For a substantial task, ask yourself:

- What kind of help do I want: discussion, explanation, diagnosis, plan, implementation, verification, or guidance?
- Did I describe what I observed before guessing why it happened?
- Is the final decision clear, especially if I changed my mind while speaking?
- Did I name the screen, workflow, account scope, and environment when relevant?
- Did I say what may change and what should be preserved?
- Is there one concrete example of the expected behavior?
- What evidence would justify calling this complete?
- Did I distinguish unknown facts from assumptions?
- Have I kept sensitive values out of the message?

For a small request, one clear sentence may answer everything necessary.

**Your target is precision, not formality:** explain what happened, what you want, what boundaries matter, and what would demonstrate success. Technical vocabulary should make those distinctions easier to express.
