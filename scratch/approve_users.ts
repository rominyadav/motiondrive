import { db } from "../src/db";
import { user } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Updating registered users to admin/approved...");
  try {
    const emailsToApprove = ["rominyadavflat@gmail.com", "office@motionsewa.com"];
    
    for (const email of emailsToApprove) {
      await db
        .update(user)
        .set({ role: "admin", status: "approved" })
        .where(eq(user.email, email));
      console.log(`Approved and made Admin: ${email}`);
    }
    
    console.log("Database update complete! Re-checking users...");
    const allUsers = await db.select().from(user);
    console.table(allUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status })));
  } catch (err) {
    console.error("Error updating users:", err);
  }
}

main();
