# Product Requirement Document (PRD)

## Project: EMA GenAI Capability Registry

---

## 1. Executive Summary & Objective

The **EMA GenAI Capability Registry** is an enterprise platform designed to manage, govern, and distribute packaged **capabilities** across the organization. Instead of building code editors and script-testing environments inside the webapp, the platform operates on an **Import, Governance, and Distribution** model. It ingests predefined **capability bundles** created by developers externally, validates them, runs them through an administrative approval workflow, and distributes them to diverse corporate AI clients (Claude Code, OpenCode, Codex, Codex CLI, GitHub Copilot Agent, and GitHub Copilot CLI).

---

## 2. Core Domain Architecture & Directory Structure

Every capability uploaded to the platform must arrive as a standardized **Universal Enterprise Capability Bundle** (`.zip` or connected Git repository package). This single zip contains the underlying multi-harness target capabilities (plugins, agents, skills, hooks, MCP).

### Universal Bundle Schema (`[capability-name]-bundle.zip`)

```
📦 [capability-name]-bundle.zip
 ┣ 📂 .claude-plugin/                --> Native Claude Code / OpenCode / Codex
 ┃ ┗ 📜 plugin.json                  --> Manifest defining local hooks & settings
 ┣ 📂 .github/                       --> Native GitHub Copilot IDE Agent routing
 ┃ ┗ 📂 agents/
 ┃   ┗ 📜 profile.agent.md           --> GitHub Copilot Agent frontmatter config
 ┣ 📂 agents/                        --> Native Claude Custom Sub-Agents
 ┃ ┗ 📜 subagent-profile.md          --> Claude sub-agent prompt boundaries
 ┣ 📂 skills/                        --> Reusable Markdown Playbooks
 ┃ ┗ 📂 [domain-specific-skill]/      
 ┃   ┗ 📜 SKILL.md                   --> Procedural instructions & constraints
 ┣ 📂 hooks/                         --> Automation Lifecycle triggers
 ┃ ┗ 📜 hooks.json                   --> Local shell command lifecycle bindings
 ┣ 📂 dist/                          --> Compiled script runtimes
 ┃ ┗ 📜 mcp-server.js                --> Model Context Protocol script
 ┗ 📜 .mcp.json                      --> Master Model Context Protocol configuration

```

---

## 3. Functional Requirements & Core Feature Modules

### Module 1: Ingestion Pipeline (Import Logic)

* **Source Options:** Users can upload a valid `.zip` bundle manually via the UI or provide an enterprise Git repository URL along with a release tag.
* **Parsing & Automated Derivation Engine:** The platform must automatically unzip the bundle in memory and read the master configuration file `.capability.json`) to extract metadata fields and derive the capability architecture hands-free:
* **Extracted Fields:** Automatically extracts the capability `name`, `description`, `client harnesses`, and `version` (validated against strict `semver` format rules).
* **Type Derivation Logic:** The engine inspects the file structure to automatically tag the bundle with its **Capability Type**:
* **Agent:** Derived if the package contains dedicated system prompts or persona layouts (e.g., `.github/agents/profile.agent.md` or `agents/subagent.md`).
* **Plugin:** Derived if the package contains an active script runtime (`dist/`) or an infrastructure schema protocol connector (`.mcp.json`).
* **Skill:** Derived if the package contains *only* procedural instruction manuals (`skills/SKILL.md`) without custom orchestration personas or runtime tools.




* **Dual-Storage Strategy:**
1. **Database Storage:** Capability name, description, client harnesses, version, and tags (assigned only by Admin during review) are persisted to an enterprise relational database (e.g., PostgreSQL).
2. **Filesystem Storage:** The raw contents of the `.zip` file are decompressed and saved to a secure corporate object storage cluster (e.g., AWS S3 or a local MinIO volume) to preserve directory paths for down-stream tool fetches.



### Module 2: Capability Catalog (The Grid View)

* **UI Standard:** An intuitive, scannable card layout.
* **Dense Metadata Display:** Each card must prominently display the capability name, version tag, derived capability type, domain owner, a short description, and inline visual tags representing the supported AI harnesses (`[Claude]`, `[GHCP IDE]`, etc.).
* **Search and Filter Panel:** A sticky multi-select filter sidebar supporting:
* Fuzzy search matching names and capability descriptions.
* **Capability Type:** Filter entries specifically by `Agents`, `Plugins`, or `Skills`.
* **Target Harness:** Filter entries based on client execution environment compatibility.
* **Functional Domain:** Grouping capabilities by category tags (e.g., `Model Development`, `Model Implementation`).



### Module 3: Capability Details & Installation View

* **UI Standard:** A clean split layout.
* **The Adaptive Tab Controller:** Users select their current GenAI environment via contextual UI tabs (e.g., `[ Claude Code / OpenCode ]`, `[ GitHub Copilot IDE ]`).
* **Contextual Output Execution:**
* Selecting anyone of the tabs (Claude Code/OpenCode, GHCP Agent, Codex/CLI) displays direct copy-paste install terminal commands pulling from the registry's CLI tool. User can also download the capability as a zip to their local machine. Using `curl` and pipe the content `bash` is also another good option.



### Module 4: "My Capabilities" Developer Dashboard

* **Ownership Isolation:** Displays an exclusive workspace grouping only the capability bundles that the logged-in user or their immediate team imported into the registry.
* **Update Lifecycle:** Allows creators to push updates to their existing catalog entries by submitting a higher semantic version bundle (e.g., uploading a `v2.4.1-patch.zip` over an existing `v2.4.0`). A newer version needs to be submitted for review. Only Admin users can perform the review. During the review, both user and admin can view and add comments to the capability that's under review. This thread needs to be maintained in the database for historical purposes. When a capability is first uploaded, it is assigned a `Draft` status. User needs to submit the capability for review by Admin, which changes the status from `Draft` to `Pending Review`. User can cancel the review, which changes the status back to `Draft`. Upon Admin approval, the capability is changed to `Active`, which allows the capability to appear in the main Capability Catalog. User can inactivate a current Active capability, which then changes its status to `Inactive`. During a review of a capability by the Admin, the Admin can reject the Capability for various reasons, which sets its status to `Rejected`.
* **Tracking Logs:** Visual indicators displaying the active production lifecycle status of each submitted version (`Draft`, `Pending Review`, `Active`, `Inactive`, `Rejected`).

### Module 5: Administrative Governance Portal (Pending Reviews)

* **Protected Queue:** A restricted view accessible solely by designated system administrators and security reviewers.
* **Granular Code-Diff Engine:** When a developer pushes an update, the admin workspace must isolate and display change histories across crucial prompt barriers side-by-side (e.g., showing exact deletions/additions to a system prompt or `SKILL.md` file).
* **Actionable Lifecycle Triggers:**
* **Approve:** Signs off on the bundle, registers the immutable version string, and pushes the updated capability to the main public catalog view instantly.
* **Reject & Comment:** Blocks the release, appends review notes directly to the creator's dashboard, and locks downstream client tool updates until a patch is resubmitted.
* **Rollback Mechanism:** Provides a one-click administrative button to instantaneously deprecate a faulty production version and revert downstream client requests back to the previous secure snapshot.



---

## 4. Key Performance & Non-Functional Constraints

* **Security & Guardrails:** The platform must enforce strict Role-Based Access Control (RBAC). Active API authentication is required before down-stream local terminals can stream structural configurations or retrieve object storage tokens.
* **Schema Rigidity:** Every update or patch ingestion must pass automatic file layout compliance checks before landing in the admin review queue. Missing required directory files (like `.claude-plugin/plugin.json` or `.github/agents/`) will immediately abort the ingestion pass.
