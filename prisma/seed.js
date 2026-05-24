const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const crypto = require("crypto");

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Seeding GenAI Capability Registry SQLite database...");

  // Clean existing data
  await prisma.reviewComment.deleteMany();
  await prisma.capabilityVersion.deleteMany();
  await prisma.capability.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Tags
  console.log("Seeding default tags...");
  const modelDevTag = await prisma.tag.create({
    data: { name: "Model-Dev", color: "#3b82f6", description: "Model development classification tag" }
  });
  const modelImplTag = await prisma.tag.create({
    data: { name: "Model-Impl", color: "#0d9488", description: "Model integration and deployment tag" }
  });
  const sdlcTag = await prisma.tag.create({
    data: { name: "SDLC", color: "#8b5cf6", description: "Software development lifecycle compliance tag" }
  });
  const cveTag = await prisma.tag.create({
    data: { name: "CVE", color: "#ef4444", description: "Vulnerability and security exposure tracking" }
  });
  const biTag = await prisma.tag.create({
    data: { name: "BI", color: "#f59e0b", description: "Business Intelligence and analytics classification" }
  });

  // 2. Seed Users
  console.log("Seeding system users...");
  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: hashPassword("adminpass!"),
      roles: "USER,ADMIN"
    }
  });
  const devUser = await prisma.user.create({
    data: {
      username: "user",
      passwordHash: hashPassword("userpass!"),
      roles: "USER"
    }
  });

  const mockBundlesDir = path.join(process.cwd(), "mock_bundles");
  const baseStorageDir = path.join(process.cwd(), ".registry_storage");
  const uploadsDir = path.join(baseStorageDir, "uploads");

  fs.mkdirSync(uploadsDir, { recursive: true });

  const seedSpecs = [
    {
      zipName: "weather-agent-bundle.zip",
      name: "weather-agent",
      description: "An enterprise GenAI Agent for weather intelligence, climate alerts, and data querying.",
      type: "PLUGIN",
      version: "1.0.0",
      owner: "Weather Implementations Team",
      status: "ACTIVE",
      harnesses: ["github-copilot", "claude"],
      tagIds: [modelDevTag.id, modelImplTag.id, sdlcTag.id],
      comments: [
        { author: "developer", text: "Initial release of the Weather Intelligence Agent bundle. Ready for general use." },
        { author: "admin", text: "Verified prompts and schema rules. Appears safe for deployment." }
      ]
    },
    {
      zipName: "database-plugin-bundle.zip",
      name: "database-plugin",
      description: "An Model Context Protocol (MCP) Plugin for secure database schema introspection and query optimization.",
      type: "PLUGIN",
      version: "2.1.0",
      owner: "Data Infrastructure Group",
      status: "ACTIVE",
      harnesses: ["claude"],
      tagIds: [modelImplTag.id, biTag.id],
      comments: [
        { author: "developer", text: "Added read-only execution tools for SQLite schema verification." },
        { author: "admin", text: "Audited source code. Access paths are safe." }
      ]
    },
    {
      zipName: "security-playbook-bundle.zip",
      name: "security-playbook",
      description: "Procedural instruction playbooks for corporate OAuth2 compliance and secret rotations.",
      type: "SKILL",
      version: "0.9.0",
      owner: "Cybersecurity Team",
      status: "PENDING_REVIEW",
      harnesses: [],
      tagIds: [sdlcTag.id, cveTag.id],
      comments: [
        { author: "developer", text: "Requesting administrative review for our new secret rotation standard operating procedure." }
      ]
    },
    {
      zipName: "model-developer-bundle.zip",
      name: "model-developer",
      description: "Econometric model development plugin. Identifies the appropriate model class, runs hyperparameter experiments to achieve the best goodness-of-fit, and outputs the Final Model Specification (equations, inputs, coefficients, error terms) for production deployment.",
      type: "PLUGIN",
      version: "1.0.0",
      owner: "Quantitative Research Team",
      status: "ACTIVE",
      harnesses: ["claude", "opencode", "codex"],
      tagIds: [modelDevTag.id, modelImplTag.id, sdlcTag.id],
      comments: [
        { author: "developer", text: "Model development engine bootstrapped with experimental grid search hooks." }
      ]
    },
    {
      zipName: "model-implementer-bundle.zip",
      name: "model-implementer",
      description: "Econometric model implementation and deployment plugin. Takes the Final Model Specification from the Model-Developer, generates the inference deployment code, and audits it using strict SDLC compliance procedures.",
      type: "PLUGIN",
      version: "1.0.0",
      owner: "Model Engineering Group",
      status: "ACTIVE",
      harnesses: ["claude", "opencode", "codex"],
      tagIds: [modelImplTag.id, sdlcTag.id],
      comments: [
        { author: "developer", text: "Model implementation pipeline configured for production inference builds." }
      ]
    },
    {
      zipName: "vulnerability-remediation-bundle.zip",
      name: "vulnerability-remediation",
      description: "Security vulnerability remediation plugin. Scans source repositories, targets security weaknesses and CVEs, synthesizes high-quality patches, and runs regression testing suites to secure the code.",
      type: "PLUGIN",
      version: "1.0.0",
      owner: "Application Security Team",
      status: "ACTIVE",
      harnesses: ["claude", "opencode", "codex"],
      tagIds: [sdlcTag.id, cveTag.id],
      comments: [
        { author: "developer", text: "AppSec scan-and-patch agent initialized with static code review tools." }
      ]
    },
    {
      zipName: "business-intelligence-bundle.zip",
      name: "business-intelligence",
      description: "Enterprise business intelligence querying plugin. Synthesizes complex analytical reporting queries and aggregates existing database data to provide visual reports and insights.",
      type: "PLUGIN",
      version: "1.0.0",
      owner: "Data Analytics Group",
      status: "ACTIVE",
      harnesses: ["claude", "opencode", "codex"],
      tagIds: [biTag.id],
      comments: [
        { author: "developer", text: "BI SQL analytics querying tools ready for operational reporting." }
      ]
    }
  ];

  for (const spec of seedSpecs) {
    const zipPathInMock = path.join(mockBundlesDir, spec.zipName);
    if (!fs.existsSync(zipPathInMock)) {
      console.error(`Warning: Mock bundle zip ${spec.zipName} not found!`);
      continue;
    }

    const zipBuffer = fs.readFileSync(zipPathInMock);
    
    // Save zip to .registry_storage/uploads
    const zipFileName = `${spec.name}-${spec.version}.zip`;
    const zipPathInStorage = path.join(uploadsDir, zipFileName);
    fs.writeFileSync(zipPathInStorage, zipBuffer);

    // Extract contents to .registry_storage/extracted/[name]/[version]
    const extractedDir = path.join(baseStorageDir, "extracted", spec.name, spec.version);
    fs.mkdirSync(extractedDir, { recursive: true });
    
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(extractedDir, true);

    // 1. Create Capability with linked tags
    const capability = await prisma.capability.create({
      data: {
        name: spec.name,
        description: spec.description,
        type: spec.type,
        owner: spec.owner,
        tags: {
          connect: spec.tagIds.map(id => ({ id }))
        }
      }
    });

    // 2. Create Version
    const capVersion = await prisma.capabilityVersion.create({
      data: {
        capabilityId: capability.id,
        version: spec.version,
        status: spec.status,
        zipPath: path.relative(process.cwd(), zipPathInStorage),
        extractedPath: path.relative(process.cwd(), extractedDir),
        harnesses: JSON.stringify(spec.harnesses),
      }
    });

    // 3. Create Comments
    for (const comment of spec.comments) {
      await prisma.reviewComment.create({
        data: {
          versionId: capVersion.id,
          author: comment.author,
          text: comment.text,
        }
      });
    }

    console.log(`Seeded capability: ${spec.name} v${spec.version} as ${spec.status} with tags`);
  }

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

