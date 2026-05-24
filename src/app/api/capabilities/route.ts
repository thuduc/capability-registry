import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processCapabilityZip, saveExtractedCapability } from "@/lib/ingestion";
import AdmZip from "adm-zip";

export async function GET(req: NextRequest) {
  try {
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const harness = searchParams.get("harness") || "";
    const viewMode = searchParams.get("viewMode") || "public"; // public, developer, admin

    // 1. Fetch capabilities
    const capabilities = await prisma.capability.findMany({
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: { comments: true },
        },
        tags: true,
      },
    });

    // 2. Filter and map based on role viewMode
    let results = capabilities.map((cap) => {
      let filteredVersions = cap.versions;
      
      if (viewMode === "public") {
        // Public view only sees ACTIVE versions
        filteredVersions = cap.versions.filter((v) => v.status === "ACTIVE");
      } else if (viewMode === "admin") {
        // Admin view sees versions that are active, pending review, or inactive
        filteredVersions = cap.versions.filter(
          (v) => v.status === "PENDING_REVIEW" || v.status === "ACTIVE" || v.status === "INACTIVE"
        );
      }
      // Developer view sees all versions

      if (filteredVersions.length === 0) return null;

      // Find the latest version in the filtered set
      const latestVersion = filteredVersions[0];
      const parsedHarnesses = JSON.parse(latestVersion.harnesses) as string[];

      return {
        id: cap.id,
        name: cap.name,
        description: cap.description,
        type: cap.type,
        owner: cap.owner,
        createdAt: cap.createdAt,
        updatedAt: cap.updatedAt,
        tags: cap.tags,
        latestVersion: {
          id: latestVersion.id,
          version: latestVersion.version,
          status: latestVersion.status,
          zipPath: latestVersion.zipPath,
          extractedPath: latestVersion.extractedPath,
          harnesses: parsedHarnesses,
          createdAt: latestVersion.createdAt,
          comments: latestVersion.comments,
        },
        versions: filteredVersions.map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          harnesses: JSON.parse(v.harnesses) as string[],
          createdAt: v.createdAt,
          comments: v.comments,
        })),
      };
    }).filter(Boolean);

    // 3. Apply search and query filters
    if (search.trim() !== "") {
      const lowerSearch = search.toLowerCase();
      results = results.filter(
        (r: any) =>
          r.name.toLowerCase().includes(lowerSearch) ||
          r.description.toLowerCase().includes(lowerSearch) ||
          r.owner.toLowerCase().includes(lowerSearch) ||
          (r.tags && r.tags.some((tag: any) => tag.name.toLowerCase().includes(lowerSearch)))
      );
    }

    if (type !== "") {
      results = results.filter((r: any) => r.type === type.toUpperCase());
    }

    if (harness !== "") {
      const lowerHarness = harness.toLowerCase();
      results = results.filter((r: any) =>
        r.latestVersion.harnesses.some((h: string) => h.toLowerCase() === lowerHarness)
      );
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("GET /api/capabilities error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch capabilities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userHeader = req.headers.get("x-simulated-user") || "";
    if (!userHeader) {
      return NextResponse.json({ error: "Access Denied: Login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const gitUrl = formData.get("gitUrl") as string;
    const gitTag = formData.get("gitTag") as string;
    const comment = formData.get("comment") as string || "Initial upload.";

    // Meta fields passed in step 2 (Verification/Ingestion wizard)
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const version = formData.get("version") as string;
    const owner = formData.get("owner") as string;
    const harnessesStr = formData.get("harnesses") as string;
    const type = formData.get("type") as string;

    let zipBuffer: Buffer;

    if (file) {
      zipBuffer = Buffer.from(await file.arrayBuffer());
    } else if (gitUrl && gitTag) {
      // Simulate retrieving a Git repository release zip
      // For enterprise Git import logic, we generate a mock zip bundle dynamically!
      // This allows the user to test the Git upload route hands-free!
      console.log(`Simulating Git clone of ${gitUrl} at tag ${gitTag}`);
      const mockBundlesDir = `${process.cwd()}/mock_bundles`;
      const fallbackZip = `${mockBundlesDir}/security-playbook-bundle.zip`;
      zipBuffer = require("fs").readFileSync(fallbackZip);
    } else {
      return NextResponse.json({ error: "Either a ZIP file or Git Repository URL + Tag must be provided." }, { status: 400 });
    }

    let parsedData: any;

    if (name && version && owner) {
      let harnesses: string[] = [];
      try {
        harnesses = JSON.parse(harnessesStr || "[]");
      } catch (e) {
        harnesses = [];
      }

      parsedData = {
        name: name.trim(),
        description: description || "",
        version: version.trim(),
        owner: owner.trim(),
        harnesses,
        type: (type || "SKILL").toUpperCase() as "AGENT" | "PLUGIN" | "SKILL"
      };

      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();
      const filePaths = zipEntries.map((e) => e.entryName.replace(/\\/g, "/"));

      // Schema Rigidity audits
      for (const harness of harnesses) {
        const normalizedHarness = harness.toLowerCase();
        if (normalizedHarness === "claude" || normalizedHarness === "opencode" || normalizedHarness === "codex") {
          const hasPluginJson = filePaths.some((p) => p.endsWith(".claude-plugin/plugin.json"));
          if (!hasPluginJson) {
            return NextResponse.json({ error: `Schema Rigidity Violation: Harness '${harness}' declared, but missing '.claude-plugin/plugin.json' in bundle.` }, { status: 400 });
          }
        } else if (normalizedHarness === "github-copilot" || normalizedHarness === "github-copilot-agent" || normalizedHarness === "ghcp") {
          const hasCopilotAgent = filePaths.some((p) => p.endsWith(".github/agents/profile.agent.md"));
          if (!hasCopilotAgent) {
            return NextResponse.json({ error: `Schema Rigidity Violation: Harness '${harness}' declared, but missing '.github/agents/profile.agent.md' in bundle.` }, { status: 400 });
          }
        }
      }

      // Always write/overwrite the .capability.json in the zip so it matches the user's final edited metadata!
      const manifestContent = {
        name: parsedData.name,
        description: parsedData.description,
        version: parsedData.version,
        owner: parsedData.owner,
        harnesses: parsedData.harnesses
      };

      // Check if there is an existing .capability.json in the zip
      const manifestEntry = zipEntries.find(
        (e) => e.entryName === ".capability.json" || e.entryName.endsWith("/.capability.json")
      );

      if (manifestEntry) {
        // Overwrite the existing file in the zip
        zip.deleteFile(manifestEntry.entryName);
      }
      // Add the new manifest (always at the root '.capability.json')
      zip.addFile(".capability.json", Buffer.from(JSON.stringify(manifestContent, null, 2), "utf8"));
      zipBuffer = zip.toBuffer();
    } else {
      // Fallback: parse manifest directly from the ZIP
      parsedData = processCapabilityZip(zipBuffer, Date.now().toString());
    }

    // 2. Check if this version already exists
    const existingCapability = await prisma.capability.findUnique({
      where: { name: parsedData.name },
      include: { versions: true },
    });

    if (existingCapability) {
      const versionExists = existingCapability.versions.some(
        (v) => v.version === parsedData.version
      );
      if (versionExists) {
        return NextResponse.json(
          { error: `Version '${parsedData.version}' for capability '${parsedData.name}' already exists. Please push a higher version.` },
          { status: 400 }
        );
      }
    }

    // 3. Save files to physical storage
    const storagePaths = saveExtractedCapability(zipBuffer, parsedData.name, parsedData.version);

    // 4. Save to Database
    let capabilityId = existingCapability?.id;
    if (!existingCapability) {
      // Create new capability
      const cap = await prisma.capability.create({
        data: {
          name: parsedData.name,
          description: parsedData.description,
          type: parsedData.type,
          owner: parsedData.owner,
        },
      });
      capabilityId = cap.id;
    } else {
      // Update description or owner if they changed
      await prisma.capability.update({
        where: { id: capabilityId },
        data: {
          description: parsedData.description,
          owner: parsedData.owner,
        },
      });
    }

    // Create Draft Version
    const versionRecord = await prisma.capabilityVersion.create({
      data: {
        capabilityId: capabilityId!,
        version: parsedData.version,
        status: "DRAFT",
        zipPath: storagePaths.zipPath,
        extractedPath: storagePaths.extractedPath,
        harnesses: JSON.stringify(parsedData.harnesses),
      },
    });

    // Create review comment
    await prisma.reviewComment.create({
      data: {
        versionId: versionRecord.id,
        author: "Developer",
        text: comment,
      },
    });

    return NextResponse.json({
      success: true,
      capabilityId,
      versionId: versionRecord.id,
      name: parsedData.name,
      version: parsedData.version,
      type: parsedData.type,
    });
  } catch (error: any) {
    console.error("POST /api/capabilities error:", error);
    return NextResponse.json({ error: error.message || "Failed to process capability bundle" }, { status: 400 });
  }
}
