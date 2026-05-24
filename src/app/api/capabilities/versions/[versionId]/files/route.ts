import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

interface FileNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const { searchParams } = new URL(req.url);
    const filePathParam = searchParams.get("file");

    // 1. Fetch version details
    const version = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const absoluteBaseDir = path.join(process.cwd(), version.extractedPath);

    if (!fs.existsSync(absoluteBaseDir)) {
      return NextResponse.json({ error: "Capability extracted files not found on disk." }, { status: 404 });
    }

    // 2. Scenario A: Read file contents
    if (filePathParam) {
      // Security Check: Sanitize path to prevent directory traversal
      const targetFilePath = path.join(absoluteBaseDir, filePathParam);
      const relative = path.relative(absoluteBaseDir, targetFilePath);
      
      const isSafe = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
      if (!isSafe || !fs.existsSync(targetFilePath)) {
        return NextResponse.json({ error: "Access Denied: Invalid or missing file path." }, { status: 403 });
      }

      const stat = fs.statSync(targetFilePath);
      if (stat.isDirectory()) {
        return NextResponse.json({ error: "Target path is a directory." }, { status: 400 });
      }

      // Read text content
      let content = "";
      try {
        content = fs.readFileSync(targetFilePath, "utf8");
      } catch (err) {
        return NextResponse.json({ error: "Unable to read binary or encrypted file." }, { status: 400 });
      }

      return NextResponse.json({ path: filePathParam, content });
    }

    // 3. Scenario B: Generate directory tree
    const fileTree = buildFileTree(absoluteBaseDir, absoluteBaseDir);
    return NextResponse.json(fileTree);
  } catch (error: any) {
    console.error("GET /api/capabilities/versions/[versionId]/files error:", error);
    return NextResponse.json({ error: error.message || "Failed to walk capability folder structure" }, { status: 500 });
  }
}

function buildFileTree(dir: string, baseDir: string): FileNode[] {
  const nodes: FileNode[] = [];
  if (!fs.existsSync(dir)) return [];

  const items = fs.readdirSync(dir);
  
  // Sort folders first, then files
  const itemsWithStats = items
    .map((item) => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      return { item, fullPath, stat };
    })
    .sort((a, b) => {
      if (a.stat.isDirectory() && !b.stat.isDirectory()) return -1;
      if (!a.stat.isDirectory() && b.stat.isDirectory()) return 1;
      return a.item.localeCompare(b.item);
    });

  for (const { item, fullPath, stat } of itemsWithStats) {
    // Exclude hidden files or package files we don't care to expose (e.g. .DS_Store)
    if (item === ".DS_Store" || item === "node_modules" || item === ".git" || item.endsWith(".zip")) {
      continue;
    }

    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (stat.isDirectory()) {
      const children = buildFileTree(fullPath, baseDir);
      nodes.push({
        name: item,
        path: relPath,
        isFolder: true,
        children,
      });
    } else {
      nodes.push({
        name: item,
        path: relPath,
        isFolder: false,
      });
    }
  }

  return nodes;
}
