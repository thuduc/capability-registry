import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = await req.json();
    const { action } = body; // SUBMIT_REVIEW, CANCEL_REVIEW, APPROVE, REJECT, DEACTIVATE, ROLLBACK

    if (!action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const version = await prisma.capabilityVersion.findUnique({
      where: { id: versionId },
      include: { capability: { include: { versions: true } } },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const currentStatus = version.status;
    let nextStatus = currentStatus;

    if (action === "SUBMIT_REVIEW") {
      if (currentStatus !== "DRAFT" && currentStatus !== "REJECTED") {
        return NextResponse.json({ error: "Only Draft or Rejected versions can be submitted for review." }, { status: 400 });
      }
      nextStatus = "PENDING_REVIEW";
    } else if (action === "CANCEL_REVIEW") {
      if (currentStatus !== "PENDING_REVIEW") {
        return NextResponse.json({ error: "Only Pending Review versions can be cancelled." }, { status: 400 });
      }
      nextStatus = "DRAFT";
    } else if (action === "APPROVE") {
      if (currentStatus !== "PENDING_REVIEW") {
        return NextResponse.json({ error: "Only Pending Review versions can be approved." }, { status: 400 });
      }
      nextStatus = "ACTIVE";
    } else if (action === "REJECT") {
      if (currentStatus !== "PENDING_REVIEW") {
        return NextResponse.json({ error: "Only Pending Review versions can be rejected." }, { status: 400 });
      }
      nextStatus = "REJECTED";
    } else if (action === "DEACTIVATE") {
      if (currentStatus !== "ACTIVE") {
        return NextResponse.json({ error: "Only Active versions can be deactivated." }, { status: 400 });
      }
      nextStatus = "INACTIVE";
    } else if (action === "ACTIVATE") {
      if (currentStatus !== "INACTIVE") {
        return NextResponse.json({ error: "Only Inactive versions can be activated directly." }, { status: 400 });
      }
      nextStatus = "ACTIVE";
    } else if (action === "ROLLBACK") {
      if (currentStatus !== "ACTIVE") {
        return NextResponse.json({ error: "Only the active production version can be rolled back." }, { status: 400 });
      }
      // Rollback logic:
      // 1. Set current version to INACTIVE
      // 2. Find the previous version that was Active or is the highest other version (e.g. sorted by creation date or semver)
      // and set it to ACTIVE.
      const otherVersions = version.capability.versions
        .filter((v) => v.id !== versionId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Descending order (newest first)

      if (otherVersions.length === 0) {
        return NextResponse.json({ error: "No historical version available to rollback to." }, { status: 400 });
      }

      const targetRollbackVersion = otherVersions[0]; // Take the next newest version to rollback to

      await prisma.$transaction([
        prisma.capabilityVersion.update({
          where: { id: versionId },
          data: { status: "INACTIVE" },
        }),
        prisma.capabilityVersion.update({
          where: { id: targetRollbackVersion.id },
          data: { status: "ACTIVE" },
        }),
        prisma.reviewComment.create({
          data: {
            versionId: versionId,
            author: "Admin",
            text: `[ROLLBACK] Deprecated version ${version.version} and rolled back production to version ${targetRollbackVersion.version}.`,
          },
        }),
        prisma.reviewComment.create({
          data: {
            versionId: targetRollbackVersion.id,
            author: "Admin",
            text: `[ROLLBACK] Re-activated as active production version due to deprecation of version ${version.version}.`,
          },
        }),
      ]);

      return NextResponse.json({ success: true, rolledBackTo: targetRollbackVersion.version });
    } else {
      return NextResponse.json({ error: `Unknown action '${action}'.` }, { status: 400 });
    }

    // Perform regular state updates
    if (nextStatus !== currentStatus) {
      if (nextStatus === "ACTIVE") {
        // Enforce dual-active exclusion: only ONE version of a capability can be ACTIVE.
        // If this version is set to ACTIVE, set all other active versions of this capability to INACTIVE
        const activeVersions = version.capability.versions.filter((v) => v.status === "ACTIVE" && v.id !== versionId);
        
        // Connect tags to the capability if tagIds is passed
        const tagConnect = body.tagIds && Array.isArray(body.tagIds)
          ? { tags: { set: body.tagIds.map((id: string) => ({ id })) } }
          : {};

        await prisma.$transaction([
          prisma.capabilityVersion.update({
            where: { id: versionId },
            data: { status: "ACTIVE" },
          }),
          ...(Object.keys(tagConnect).length > 0 ? [
            prisma.capability.update({
              where: { id: version.capabilityId },
              data: tagConnect,
            })
          ] : []),
          ...activeVersions.map((v) =>
            prisma.capabilityVersion.update({
              where: { id: v.id },
              data: { status: "INACTIVE" },
            })
          ),
          prisma.reviewComment.create({
            data: {
              versionId,
              author: action === "ACTIVATE" ? "Developer" : "Admin",
              text: action === "ACTIVATE"
                ? `Re-activated capability version ${version.version}. Capability is now ACTIVE in the public catalog.`
                : `Approved release. Capability version ${version.version} is now ACTIVE in the public catalog.`,
            },
          }),
        ]);
      } else {
        // Standard transition
        await prisma.capabilityVersion.update({
          where: { id: versionId },
          data: { status: nextStatus },
        });

        // Log comments for status audits
        let auditComment = "";
        if (nextStatus === "PENDING_REVIEW") {
          auditComment = `Submitted capability version ${version.version} for administrative review.`;
        } else if (nextStatus === "DRAFT" && currentStatus === "PENDING_REVIEW") {
          auditComment = `Cancelled review submission for version ${version.version}. Reverted to Draft.`;
        } else if (nextStatus === "REJECTED") {
          auditComment = `Rejected release for version ${version.version}. Version is locked.`;
        } else if (nextStatus === "INACTIVE") {
          auditComment = `Deactivated version ${version.version}. Capability is no longer visible in the public catalog.`;
        }

        if (auditComment !== "") {
          await prisma.reviewComment.create({
            data: {
              versionId,
              author: action.includes("ADMIN") || action === "REJECT" || action === "APPROVE" ? "Admin" : "Developer",
              text: auditComment,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error: any) {
    console.error("PATCH /api/capabilities/versions/[versionId]/status error:", error);
    return NextResponse.json({ error: error.message || "Failed to update lifecycle status" }, { status: 500 });
  }
}
