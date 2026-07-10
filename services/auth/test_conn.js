const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_VYUuNmkF@ep-falling-butterfly-ah64j8z4-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  console.log("Connecting directly via connection string...");
  await client.connect();
  console.log("Connected successfully!");
  const res = await client.query("SELECT NOW()");
  console.log("Database time:", res.rows[0]);
  await client.end();
}

test().catch(err => {
  console.error("Connection failed:", err.message);
  process.exit(1);
});
