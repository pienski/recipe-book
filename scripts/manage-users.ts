import { db } from "../lib/db";
import { users, families } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);

async function printUsage() {
  console.log(`
Usage:
  npm run manage-users <command> [options]

Users:
  list-users                                                 List all users
  create-user <email> <name> <password> <familyId>           Create a new user
  update-user-password <email> <newPassword>                 Update a user's password
  delete-user <email>                                        Delete a user

Families:
  list-families                                              List all families
  create-family <name> [appName]                             Create a new family (appName defaults to 'Ginger')
  update-family <id> <name> [appName]                        Update a family's name/appName
  delete-family <id>                                         Delete a family (only if no users attached)
`);
  process.exit(1);
}

async function main() {
  if (args.length === 0) {
    await printUsage();
  }

  const command = args[0];

  try {
    switch (command) {
      // --- USERS ---
      case "list-users": {
        const allUsers = await db.query.users.findMany({
          with: { family: true }
        });
        console.log(`Found ${allUsers.length} users:`);
        allUsers.forEach(u => {
          console.log(`- ${u.name} <${u.email}> (ID: ${u.id})`);
          console.log(`  Family: ${u.family?.name || 'N/A'} (Family ID: ${u.familyId})`);
        });
        break;
      }
      
      case "create-user": {
        const [, email, name, password, familyId] = args;
        if (!email || !name || !password || !familyId) {
          console.error("Error: Missing arguments for create-user.");
          console.log("Usage: create-user <email> <name> <password> <familyId>");
          process.exit(1);
        }

        // Check if family exists
        const family = await db.query.families.findFirst({ where: eq(families.id, familyId) });
        if (!family) {
          console.error(`Error: Family with ID '${familyId}' does not exist.`);
          process.exit(1);
        }

        const passwordHash = await bcrypt.hash(password, 10);
        
        await db.insert(users).values({
          email,
          name,
          passwordHash,
          familyId,
        });
        
        console.log(`✅ Successfully created user: ${name} <${email}> in family '${family.name}'`);
        break;
      }
      
      case "update-user-password": {
        const [, email, newPassword] = args;
        if (!email || !newPassword) {
          console.error("Error: Missing arguments for update-user-password.");
          console.log("Usage: update-user-password <email> <newPassword>");
          process.exit(1);
        }

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user) {
          console.error(`Error: User with email '${email}' not found.`);
          process.exit(1);
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.update(users)
          .set({ passwordHash, updated_at: new Date() })
          .where(eq(users.email, email));
          
        console.log(`✅ Successfully updated password for user: ${email}`);
        break;
      }

      case "delete-user": {
        const [, email] = args;
        if (!email) {
          console.error("Error: Missing argument for delete-user.");
          console.log("Usage: delete-user <email>");
          process.exit(1);
        }

        const result = await db.delete(users).where(eq(users.email, email)).returning();
        if (result.length > 0) {
          console.log(`✅ Successfully deleted user: ${email}`);
        } else {
          console.log(`Error: User with email '${email}' not found.`);
        }
        break;
      }

      // --- FAMILIES ---
      case "list-families": {
        const allFamilies = await db.query.families.findMany();
        console.log(`Found ${allFamilies.length} families:`);
        allFamilies.forEach(f => {
          console.log(`- ID: ${f.id}`);
          console.log(`  Name: ${f.name}`);
          console.log(`  App Name: ${f.appName}`);
        });
        break;
      }
      
      case "create-family": {
        const [, name, appName = "Ginger"] = args;
        if (!name) {
          console.error("Error: Missing arguments for create-family.");
          console.log("Usage: create-family <name> [appName]");
          process.exit(1);
        }

        const result = await db.insert(families).values({
          name,
          appName
        }).returning();
        
        console.log(`✅ Successfully created family: '${result[0].name}' with ID: ${result[0].id}`);
        break;
      }

      case "update-family": {
        const [, id, name, appName] = args;
        if (!id || !name) {
          console.error("Error: Missing arguments for update-family.");
          console.log("Usage: update-family <id> <name> [appName]");
          process.exit(1);
        }

        const updateData: Partial<{ name: string; appName: string; updated_at: Date }> = { 
          name, 
          updated_at: new Date() 
        };
        if (appName) {
          updateData.appName = appName;
        }

        const result = await db.update(families)
          .set(updateData)
          .where(eq(families.id, id))
          .returning();

        if (result.length > 0) {
          console.log(`✅ Successfully updated family: '${result[0].name}'`);
        } else {
          console.log(`Error: Family with ID '${id}' not found.`);
        }
        break;
      }

      case "delete-family": {
        const [, id] = args;
        if (!id) {
          console.error("Error: Missing argument for delete-family.");
          console.log("Usage: delete-family <id>");
          process.exit(1);
        }

        // First check if any users belong to this family to prevent foreign key errors
        const familyUsers = await db.query.users.findMany({ where: eq(users.familyId, id) });
        if (familyUsers.length > 0) {
          console.error(`Error: Cannot delete family '${id}'. It still has ${familyUsers.length} user(s) attached.`);
          console.log(`Please delete the users first or move them to another family.`);
          process.exit(1);
        }

        const result = await db.delete(families).where(eq(families.id, id)).returning();
        if (result.length > 0) {
          console.log(`✅ Successfully deleted family: '${result[0].name}' (ID: ${id})`);
        } else {
          console.log(`Error: Family with ID '${id}' not found.`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        await printUsage();
    }
  } catch (error) {
    console.error("❌ An error occurred:", error);
  }
  
  process.exit(0);
}

main();
