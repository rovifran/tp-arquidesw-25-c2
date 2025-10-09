import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { init, migrateFromJson } from "./state-redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadJsonFile(fileName) {
  const filePath = path.join(__dirname, "state", fileName);
  
  try {
    await fs.promises.access(filePath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code == "ENOENT") {
      console.log(`${filePath} not found, using empty data`);
      return fileName === "log.json" ? [] : {};
    } else {
      console.error(`Error loading ${filePath}:`, err);
      throw err;
    }
  }
}

async function migrate() {
  try {
    console.log("Starting migration from JSON files to Redis...");
    
    // Initialize Redis connection
    await init();
    
    // Load existing JSON data
    console.log("Loading existing JSON data...");
    const accountsData = await loadJsonFile("accounts.json");
    const ratesData = await loadJsonFile("rates.json");
    const logData = await loadJsonFile("log.json");
    
    console.log("Migrating data to Redis...");
    await migrateFromJson(accountsData, ratesData, logData);
    
    console.log("Migration completed successfully!");
    console.log("You can now remove the JSON files from the state/ directory if desired.");
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate };
