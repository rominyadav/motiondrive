import { db } from "../src/db";
import { user } from "../src/db/schema";

async function main() {
  console.log("Fetching registered users...");
  try {
    const allUsers = await db.select().from(user);
    console.log("Users in database:");
    console.table(allUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status })));
  } catch (err) {
    console.error("Error fetching users:", err);
  }
}

main();
