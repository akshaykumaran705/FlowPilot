# 🌟 FlowPilot --- AI-Driven Developer Workday Orchestrator

FlowPilot is an **AI-powered productivity system** for developers.\
It intelligently organizes your day into deep-work and shallow-work
blocks, creates contextual "Session Capsules", handles interruptions,
and gives you a complete workflow assistant --- powered by **Google
Gemini**, **MCP Servers**, and **GitHub/Jira/Slack integrations**.

FlowPilot uses the **Model Context Protocol (MCP)** to safely access
external systems (GitHub, Jira, Slack, Calendar) without exposing API
keys directly to the backend or the AI.

This repository includes:

-   ✅ Node.js + TypeScript backend (FlowPilot Core)\
-   ✅ GitHub MCP server\
-   🚧 Jira MCP server (optional)\
-   🚧 Slack MCP server (optional)\
-   🚧 Calendar MCP server (optional)\
-   🚀 Ready to extend into a React frontend

------------------------------------------------------------------------

## 🧠 What FlowPilot Does

FlowPilot helps developers stay in flow state by:

### ⭐ 1. Planning Your Day

AI builds a full schedule based on: - GitHub issues\
- Jira tasks\
- Calendar events\
- Working hours\
- Task priority & complexity

### ⭐ 2. Creating Context-Rich Focus Sessions

Each session includes: - Issue details\
- Slack thread summaries\
- Notes & test results\
- AI-generated session summary\
- Next steps & decisions

### ⭐ 3. Handling Interruptions Smartly

FlowPilot monitors: - New GitHub issues\
- PR assignments\
- Slack mentions\
- Calendar updates

AI classifies interruptions as: - **URGENT** - **LATER** - **IGNORE**

And updates your plan automatically.

### ⭐ 4. Realtime Database Storage

Uses Firebase Realtime Database to store: - Daily plans\
- Sessions\
- Notifications\
- Settings\
- Local tasks

------------------------------------------------------------------------

## 🏗️ Project Structure

\`\`\` FlowPilot/ │ ├── backend/\
│ ├── src/ │ │ ├── agents/\
│ │ ├── config/\
│ │ ├── integrations/\
│ │ ├── routes/\
│ │ ├── types/\
│ │ └── server.ts\
│ ├── package.json │ └── .env │ └── mcp-servers/ └── github/\
├── src/server.ts ├── package.json ├── .env └── README.md (optional)
\`\`\`

------------------------------------------------------------------------

## 🛠️ Technologies Used

  Layer          Technology
  -------------- --------------------------------------
  Backend        Node.js, TypeScript, Express
  AI             Google Gemini Pro
  Database       Firebase Realtime Database
  Integrations   MCP Servers
  MCP Server     Express, Octokit, Axios
  Task Sources   GitHub, Jira (optional), Local tasks

------------------------------------------------------------------------

## ⚙️ Setup Instructions

### 🔧 1. Clone Repo

\`\`\`bash git clone
https://github.com/`<your-username>`{=html}/FlowPilot.git cd FlowPilot
\`\`\`

### 🔧 2. Setup Backend

\`\`\`bash cd backend npm install \`\`\`

Create `.env`: \`\`\` PORT=4000 GEMINI_API_KEY=your-gemini-api-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE
KEY-----`\n`{=tex}...`\n`{=tex}-----END PRIVATE KEY-----`\n`{=tex}
DEFAULT_TIMEZONE=America/New_York DEFAULT_WORK_START=09:00
DEFAULT_WORK_END=17:00 \`\`\`

Run backend: \`\`\`bash npm run dev \`\`\`

------------------------------------------------------------------------

### 🔧 3. Setup GitHub MCP Server

\`\`\`bash cd mcp-servers/github npm install \`\`\`

Create `.env`: \`\`\` GITHUB_PAT=ghp_your_token_here PORT=5001
GITHUB_OWNER=your-github-username GITHUB_REPO=repo-name
GITHUB_USERNAME=your-github-username \`\`\`

Run MCP: \`\`\`bash npm run dev \`\`\`

Test:

    http://localhost:5001/tools/getAssignedIssues

------------------------------------------------------------------------

## 🧪 Testing with Postman

Example endpoints: - `POST /api/settings` - `GET /api/settings` -
`GET /api/tasks/github` - `POST /api/tasks/local` -
`POST /api/plan-day` - `POST /api/session/start` -
`POST /api/session/event` - `POST /api/session/end` -
`POST /api/notifications/poll`

------------------------------------------------------------------------

## ⚡ Roadmap

  Feature           Status
  ----------------- ----------------
  GitHub MCP        ✅ Complete
  Jira MCP          🟡 In Progress
  Slack MCP         🟡 In Progress
  Calendar MCP      🟡 In Progress
  React Frontend    🚧 Planned
  Multi-user Auth   🚧 Future

------------------------------------------------------------------------

## 🤝 Contributing

1.  Fork\
2.  Create branch\
3.  Commit changes\
4.  PR

------------------------------------------------------------------------

## 📄 License

MIT License.

------------------------------------------------------------------------

## ⭐ Support the Project

If you find FlowPilot useful, please ⭐ the repository!
