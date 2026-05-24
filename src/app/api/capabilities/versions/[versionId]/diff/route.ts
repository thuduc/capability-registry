import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import * as jsdiff from "diff";

interface FileDiffResult {
  fileName: string;
  hasChanges: boolean;
  oldContent: string | null;
  newContent: string | null;
  diffParts: { value: string; added?: boolean; removed?: boolean }[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;

    // 1. Fetch current version details
    const currentVersion = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
      include: { capability: { include: { versions: true } } },
    });

    if (!currentVersion) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    // 2. Find previous version (e.g. the highest other version, or previously ACTIVE)
    const otherVersions = currentVersion.capability.versions
      .filter((v) => v.id !== versionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const previousVersion = otherVersions[0]; // Newest historical version

    if (!previousVersion) {
      // First version ever! All files are purely new additions.
      const currentDir = path.join(process.cwd(), currentVersion.extractedPath);
      const diffs = getFilesDiffs(null, currentDir);
      return NextResponse.json({ isFirstVersion: true, previousVersion: null, diffs });
    }

    // 3. Compute diff between previous and current directories
    const prevDir = path.join(process.cwd(), previousVersion.extractedPath);
    const currentDir = path.join(process.cwd(), currentVersion.extractedPath);
    
    const diffs = getFilesDiffs(prevDir, currentDir);

    return NextResponse.json({
      isFirstVersion: false,
      previousVersion: previousVersion.version,
      diffs,
    });
  } catch (error: any) {
    console.error("GET /api/capabilities/versions/[versionId]/diff error:", error);
    return NextResponse.json({ error: error.message || "Failed to calculate file diffs" }, { status: 500 });
  }
}

// Recursive helper to list all files in directory
function getAllFiles(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
  
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath));
    }
  });
  return results;
}

function getFilesDiffs(prevDir: string | null, currentDir: string): FileDiffResult[] {
  const currentFiles = getAllFiles(currentDir);
  const prevFiles = prevDir ? getAllFiles(prevDir) : [];

  // Union of all relative file paths
  const allRelativePaths = Array.from(new Set([...currentFiles, ...prevFiles]))
    .filter((p) => !p.startsWith("node_modules") && !p.startsWith(".git") && !p.endsWith(".zip"))
    // Filter only files we care about (prompts, instruction manuals, json configs)
    .filter(
      (p) =>
        p.endsWith(".md") ||
        p.endsWith(".json") ||
        p.endsWith(".js") ||
        p.endsWith(".ts")
    );

  const diffResults: FileDiffResult[] = [];

  for (const relPath of allRelativePaths) {
    const prevFilePath = prevDir ? path.join(prevDir, relPath) : null;
    const currentFilePath = path.join(currentDir, relPath);

    let prevContent: string | null = null;
    let currentContent: string | null = null;

    if (prevFilePath && fs.existsSync(prevFilePath)) {
      prevContent = fs.readFileSync(prevFilePath, "utf8");
    }
    if (fs.existsSync(currentFilePath)) {
      currentContent = fs.readFileSync(currentFilePath, "utf8");
    }

    const hasChanges = prevContent !== currentContent;
    const diffParts = jsdiff.diffLines(prevContent || "", currentContent || "");

    diffResults.push({
      fileName: relPath.replace(/\\/g, "/"),
      hasChanges,
      oldContent: prevContent,
      newContent: currentContent,
      diffParts: diffParts.map((part) => ({
        value: part.value,
        added: part.added,
        removed: part.removed,
      })),
    });
  }

  return diffResults;
}
