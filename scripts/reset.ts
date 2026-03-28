import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { list, del } from "@vercel/blob";

async function main() {
  console.log("--- Resetting DB and Blob storage ---\n");

  // 1. Reset DB
  console.log("[DB] Connecting...");
  const connStr = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error("No POSTGRES_PRISMA_URL or POSTGRES_URL found in env");
    process.exit(1);
  }

  const url = new URL(connStr);
  url.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const count = await prisma.song.count();
  console.log(`[DB] Found ${count} songs, deleting...`);
  await prisma.song.deleteMany();
  console.log("[DB] All songs deleted.\n");

  await prisma.$disconnect();
  await pool.end();

  // 2. Reset Blob storage
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("[Blob] No BLOB_READ_WRITE_TOKEN found, skipping blob cleanup.");
    return;
  }

  console.log("[Blob] Listing audio files...");
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const result = await list({ prefix: "audio/", cursor });
    for (const blob of result.blobs) {
      await del(blob.url);
      deleted++;
      console.log(`  Deleted: ${blob.pathname}`);
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  console.log(`[Blob] Deleted ${deleted} audio files.\n`);
  console.log("--- Reset complete ---");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
