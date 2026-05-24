import { prisma } from "../src/lib/db";

async function run() {
  console.log("Checking seeded version comment data...");
  const versions = await prisma.capabilityVersion.findMany({
    include: { comments: true }
  });

  if (versions.length === 0) {
    console.error("No capability versions found in the database. Please run the seed first.");
    process.exit(1);
  }

  const targetVersion = versions[0];
  console.log(`Found capability version: ${targetVersion.version} (ID: ${targetVersion.id})`);
  console.log(`Existing comments: ${targetVersion.comments.length}`);

  console.log("Adding a test comment as Admin...");
  // Simulate POST route creation
  const newComment = await prisma.reviewComment.create({
    data: {
      versionId: targetVersion.id,
      author: "Admin",
      text: "Verification testing comment: what changed?"
    }
  });

  console.log("Successfully created review comment in database:");
  console.dir(newComment);

  // Clean up
  await prisma.reviewComment.delete({
    where: { id: newComment.id }
  });
  console.log("Successfully deleted the test comment (cleanup complete).");
  console.log("PASS: Comments database operation verified successfully!");
}

run().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
