import { readFile } from "node:fs/promises";
import { mysqlConfig } from "../lib/config.js";
import { openDatabase } from "../lib/mysql.js";

const pool = openDatabase(mysqlConfig(process.env));
try {
  const sql = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  for (const statement of sql.split(";").map(part => part.trim()).filter(Boolean)) await pool.query(statement);
  console.log("Everkeep database tables are ready.");
} finally {
  await pool.end();
}
