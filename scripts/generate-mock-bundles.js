const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const outputDir = path.join(process.cwd(), "mock_bundles");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Generating mock capability zip bundles in:", outputDir);

// Helper to create a zip bundle
function createBundle(filename, files) {
  const zip = new AdmZip();
  files.forEach((file) => {
    zip.addFile(file.path, Buffer.from(file.content, "utf8"));
  });
  const outputPath = path.join(outputDir, filename);
  zip.writeZip(outputPath);
  console.log(`- Created ${filename} (${files.length} files)`);
}

// 1. Weather Agent Bundle (AGENT TYPE)
createBundle("weather-agent-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "weather-agent",
      description: "An enterprise GenAI Agent for weather intelligence, climate alerts, and data querying.",
      version: "1.0.0",
      owner: "Weather Implementations Team",
      harnesses: ["github-copilot", "claude"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "weather-agent",
      name: "Weather Agent Plugin",
      version: "1.0.0",
      description: "Harness integration for Claude Code."
    }, null, 2)
  },
  {
    path: ".github/agents/profile.agent.md",
    content: `# Weather Agent Profile
You are a GenAI Weather Intelligence agent. Your job is to answer questions about global weather, perform meteorological analysis, and issue climate warning guidelines.

## Capabilities
- Get real-time temperature updates
- Generate severe weather warnings
- Output formatted markdown weather tables
`
  },
  {
    path: "agents/subagent-profile.md",
    content: `# Weather Subagent Prompts
Follow these strict guidelines when executing sub-agent calls:
1. Always output temperatures in both Celsius and Fahrenheit.
2. Maintain a highly professional, clinical tone.
`
  },
  {
    path: "skills/weather-forecasting/SKILL.md",
    content: `# Skill: Weather Forecasting & Warnings
Procedural guidelines for checking atmospheric pressure, humidity, and barometric trends.

## Instructions
1. Query the NOAA database or local airport station code.
2. Cross-reference barometric shifts over the past 6 hours.
3. If delta is > 0.05 inHg, note a front transition.
`
  }
]);

// 2. Database Plugin Bundle (PLUGIN TYPE)
createBundle("database-plugin-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "database-plugin",
      description: "An Model Context Protocol (MCP) Plugin for secure database schema introspection and query optimization.",
      version: "2.1.0",
      owner: "Data Infrastructure Group",
      harnesses: ["claude"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "database-plugin",
      name: "DB Schema Plugin",
      version: "2.1.0"
    }, null, 2)
  },
  {
    path: "dist/mcp-server.js",
    content: `// Model Context Protocol Server for SQLite database schemas
const { Server } = require("@modelcontextprotocol/sdk");
// Bootstraps a lightweight schema-viewer tool for database introspection.
console.log("MCP Server running...");
`
  },
  {
    path: ".mcp.json",
    content: JSON.stringify({
      mcpServers: {
        "database-plugin": {
          command: "node",
          args: ["dist/mcp-server.js"],
          env: {
            DB_READONLY: "true"
          }
        }
      }
    }, null, 2)
  }
]);

// 3. Security Playbook Bundle (SKILL TYPE)
createBundle("security-playbook-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "security-playbook",
      description: "Procedural instruction playbooks for corporate OAuth2 compliance and secret rotations.",
      version: "0.9.0",
      owner: "Cybersecurity Team",
      harnesses: []
    }, null, 2)
  },
  {
    path: "skills/oauth2-rotation/SKILL.md",
    content: `# Skill: OAuth2 Secret Rotation
Procedural guide to rotating active API gateway client secrets without downtime.

## Step-by-Step Procedure
1. Provision secondary client secret in the identity portal.
2. Deploy the secondary secret to all consumer client stores.
3. Monitor traffic. Once secondary secret accounts for 100% of calls, deprecate primary secret.
`
  }
]);

// 4. Model-Developer Bundle (AGENT/PLUGIN TYPE)
createBundle("model-developer-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "model-developer",
      description: "Econometric model development plugin. Identifies the appropriate model class, runs hyperparameter experiments to achieve the best goodness-of-fit, and outputs the Final Model Specification (equations, inputs, coefficients, error terms) for production deployment.",
      version: "1.0.0",
      owner: "Quantitative Research Team",
      harnesses: ["claude", "opencode", "codex"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "model-developer",
      name: "Model Developer Plugin",
      version: "1.0.0",
      description: "Econometric model development and experimentation harness integration."
    }, null, 2)
  },
  {
    path: "dist/mcp-server.js",
    content: `// MCP Server for Econometric Model Estimation & Goodness-of-Fit Tests
console.log("Model-Developer MCP Server initialized.");
`
  },
  {
    path: ".mcp.json",
    content: JSON.stringify({
      mcpServers: {
        "model-developer": {
          command: "node",
          args: ["dist/mcp-server.js"],
          env: {
            ESTIMATION_ENGINE: "ols,probit,logit"
          }
        }
      }
    }, null, 2)
  },
  {
    path: "agents/subagent-profile.md",
    content: `# Econometric Experimentation Agent
You are an expert quantitative research agent specializing in econometrics and statistical fit modeling.

## Responsibilities
1. Parse statistical modeling requirements.
2. Estimate parameters and verify coefficient statistical significance.
3. Output the Final Model Specification containing formulas, inputs, error structures, and coefficients.
`
  },
  {
    path: "skills/econometric-experimentation/SKILL.md",
    content: `# Skill: Econometric Experimentation & Hyperparameter Tuning
Procedures to run statistical grid-search experiments and verify regression residuals.

## Guidelines
1. Check for heteroscedasticity using White's test.
2. Select parameters minimizing Akaike Information Criterion (AIC).
3. Draft output equation in LaTeX and JSON format.
`
  }
]);

// 5. Model-Implementer Bundle (AGENT/PLUGIN TYPE)
createBundle("model-implementer-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "model-implementer",
      description: "Econometric model implementation and deployment plugin. Takes the Final Model Specification from the Model-Developer, generates the inference deployment code, and audits it using strict SDLC compliance procedures.",
      version: "1.0.0",
      owner: "Model Engineering Group",
      harnesses: ["claude", "opencode", "codex"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "model-implementer",
      name: "Model Implementer Plugin",
      version: "1.0.0",
      description: "Production code synthesis and SDLC deployment review harness integration."
    }, null, 2)
  },
  {
    path: "dist/mcp-server.js",
    content: `// MCP Server for Production Code Ingestion & SDLC Compliance Verifiers
console.log("Model-Implementer MCP Server initialized.");
`
  },
  {
    path: ".mcp.json",
    content: JSON.stringify({
      mcpServers: {
        "model-implementer": {
          command: "node",
          args: ["dist/mcp-server.js"],
          env: {
            DEPLOYMENT_TARGET: "production-kubernetes"
          }
        }
      }
    }, null, 2)
  },
  {
    path: "agents/subagent-profile.md",
    content: `# Model Implementation Agent
You are an expert systems deployment agent responsible for converting econometric equations into optimized, high-throughput production code.

## Responsibilities
1. Parse equations and coefficient JSON specs.
2. Implement strict input sanitization and unit-testing.
3. Conduct automatic SDLC checks and package container builds.
`
  },
  {
    path: "skills/production-deployment/SKILL.md",
    content: `# Skill: Production Deployment & SDLC Controls
Step-by-step procedure to transition draft model code into a production container environment.

## SDLC Requirements
1. Verify unit test coverage is >= 95%.
2. Run micro-benchmark tests for latency.
3. Register the production model endpoint in the routing proxy.
`
  }
]);

// 6. Vulnerability-Remediation Bundle (AGENT/PLUGIN TYPE)
createBundle("vulnerability-remediation-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "vulnerability-remediation",
      description: "Security vulnerability remediation plugin. Scans source repositories, targets security weaknesses and CVEs, synthesizes high-quality patches, and runs regression testing suites to secure the code.",
      version: "1.0.0",
      owner: "Application Security Team",
      harnesses: ["claude", "opencode", "codex"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "vulnerability-remediation",
      name: "Vulnerability Remediation Plugin",
      version: "1.0.0",
      description: "Security scanning and automated codebase patching harness integration."
    }, null, 2)
  },
  {
    path: "dist/mcp-server.js",
    content: `// MCP Server for Codebase Security Scanning & AST Patch Generation
console.log("Vulnerability-Remediation MCP Server initialized.");
`
  },
  {
    path: ".mcp.json",
    content: JSON.stringify({
      mcpServers: {
        "vulnerability-remediation": {
          command: "node",
          args: ["dist/mcp-server.js"],
          env: {
            SECURE_AST_SCANNING: "enabled"
          }
        }
      }
    }, null, 2)
  },
  {
    path: "agents/subagent-profile.md",
    content: `# AppSec Remediation Agent
You are a secure code engineering agent dedicated to scanning codebases, isolating vulnerable AST paths, and applying robust fixes.

## Responsibilities
1. Map static security warning positions.
2. Formulate target-specific patches without modifying business behaviors.
3. Validate patch correctness using unit regression tests.
`
  },
  {
    path: "skills/vulnerability-patching/SKILL.md",
    content: `# Skill: Vulnerability Remediation & Security Patches
Guidelines for safely fixing common CWE issues (OWASP Top 10, memory leaks, secret disclosures).

## Steps
1. Parse the security report (e.g. SonarQube, Snyk).
2. Rewrite the file to securely bind inputs (e.g. prevent SQLi / XSS).
3. Assert regression tests pass successfully.
`
  }
]);

// 7. Business-Intelligence Bundle (AGENT/PLUGIN TYPE)
createBundle("business-intelligence-bundle.zip", [
  {
    path: ".capability.json",
    content: JSON.stringify({
      name: "business-intelligence",
      description: "Enterprise business intelligence querying plugin. Synthesizes complex analytical reporting queries and aggregates existing database data to provide visual reports and insights.",
      version: "1.0.0",
      owner: "Data Analytics Group",
      harnesses: ["claude", "opencode", "codex"]
    }, null, 2)
  },
  {
    path: ".claude-plugin/plugin.json",
    content: JSON.stringify({
      id: "business-intelligence",
      name: "Business Intelligence Plugin",
      version: "1.0.0",
      description: "Analytical querying, data visual reporting, and database indexing harness integration."
    }, null, 2)
  },
  {
    path: "dist/mcp-server.js",
    content: `// MCP Server for Analytical SQL Generation & Report Assembly
console.log("Business-Intelligence MCP Server initialized.");
`
  },
  {
    path: ".mcp.json",
    content: JSON.stringify({
      mcpServers: {
        "business-intelligence": {
          command: "node",
          args: ["dist/mcp-server.js"],
          env: {
            DATA_WAREHOUSE_TARGET: "snowflake"
          }
        }
      }
    }, null, 2)
  },
  {
    path: "agents/subagent-profile.md",
    content: `# Business Intelligence Agent
You are a data reporting agent. Your objective is to extract analytical insights and assemble executive summaries from operational data stores.

## Responsibilities
1. Interpret natural language BI requests into analytical queries.
2. Perform metric aggregations (growth rate, moving averages).
3. Output markdown-formatted reporting tables and charts.
`
  },
  {
    path: "skills/bi-querying/SKILL.md",
    content: `# Skill: BI Querying & Pivot Analysis
Procedures for designing dimensional data queries and aggregating database logs.

## Rules
1. Never run destructive operations (DML/DDL write blocks).
2. Filter null values proactively.
3. Group metrics strictly by calendar dimension variables.
`
  }
]);

console.log("Mock capability bundles generated successfully!");
