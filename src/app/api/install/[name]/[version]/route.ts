import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; version: string }> }
) {
  try {
    const { name, version } = await params;
    const { searchParams } = new URL(req.url);
    const isFileDownload = searchParams.get("file") === "true";

    // Query capability by name and version
    const capVersion = await prisma.capabilityVersion.findFirst({
      where: {
        version: version,
        capability: {
          name: name
        }
      },
      include: { capability: true }
    });

    if (!capVersion) {
      return NextResponse.json({ error: `Capability version ${name} v${version} not found.` }, { status: 404 });
    }

    const absoluteZipPath = path.resolve(process.cwd(), capVersion.zipPath);
    if (!fs.existsSync(absoluteZipPath)) {
      return NextResponse.json({ error: "ZIP bundle file not found on disk." }, { status: 404 });
    }

    // SCENARIO 1: Serve the raw ZIP file binary stream
    if (isFileDownload) {
      const fileBuffer = fs.readFileSync(absoluteZipPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${name}-${version}.zip"`,
          "Content-Length": fileBuffer.length.toString()
        }
      });
    }

    // SCENARIO 2: Serve the dynamic bash installer bootstrap script
    const origin = req.nextUrl.origin || "http://localhost:3000";
    
    const bashScript = `#!/bin/bash
# ==============================================================================
# EMA GenAI Capability Registry - Automated Bootstrap Installer
# Capability: ${name} v${version}
# Generated: ${new Date().toISOString()}
# ==============================================================================
set -e

CAP_NAME="${name}"
CAP_VER="${version}"
REGISTRY_URL="${origin}"

# Formatting tokens
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}====================================================\${NC}"
echo -e "\${BLUE}   EMA GenAI Capability Automated Installer         \${NC}"
echo -e "\${BLUE}====================================================\${NC}"
echo -e "📦 Target: \${GREEN}\${CAP_NAME} (v\${CAP_VER})\${NC}"
echo -e "🌐 Source: \${BLUE}\${REGISTRY_URL}\${NC}"
echo ""

# 1. Sanity checks: Verify unzip utility exists
if ! command -v unzip &> /dev/null; then
    echo -e "\${RED}Error: 'unzip' utility is not found on your system.\${NC}"
    echo "Please install 'unzip' using your system package manager (e.g. apt, brew, yum) and try again."
    exit 1
fi

# 2. Provision secure temp folder for download
TEMP_ZIP=\$(mktemp /tmp/ema-install-XXXXXX.zip)

# Cleanup trap to ensure temporary zip is deleted even on failure
trap 'rm -f "$TEMP_ZIP"' EXIT

echo -e "📥 Downloading binary ZIP bundle..."
DOWNLOAD_URL="\${REGISTRY_URL}/api/install/\${CAP_NAME}/\${CAP_VER}?file=true"

# 3. Pull package binary from webapp
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_ZIP"; then
    echo -e "\${RED}Error: Failed to download ZIP bundle from the registry.\${NC}"
    exit 1
fi

echo -e "⚙️  Extracting capability bundle directly into current directory..."

# 4. Extract cleanly in place
if ! unzip -oq "$TEMP_ZIP" -d .; then
    echo -e "\${RED}Error: Failed to decompress capability ZIP bundle.\${NC}"
    exit 1
fi

echo ""
echo -e "\${GREEN}✨ SUCCESS: \${CAP_NAME} v\${CAP_VER} has been installed! \${NC}"
echo -e "📁 Directory: \$(pwd)"
echo -e "\${BLUE}====================================================\${NC}"
`;

    // Return plain bash script text
    return new NextResponse(bashScript, {
      status: 200,
      headers: {
        "Content-Type": "text/x-shellscript",
        "Content-Disposition": "inline; filename=\"install.sh\""
      }
    });
  } catch (error: any) {
    console.error("GET /api/install/[name]/[version] error:", error);
    return NextResponse.json({ error: error.message || "Installer bootstrap failed" }, { status: 500 });
  }
}
