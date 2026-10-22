import { clerkClient } from "@clerk/express";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email) {
  throw new Error("Set ADMIN_EMAIL to the trusted account before running this command.");
}

const matches = await clerkClient.users.getUserList({
  emailAddress: [email],
  limit: 2,
});
if (matches.data.length !== 1) {
  throw new Error("Expected exactly one matching signed-in account; no role was changed.");
}

const user = matches.data[0];
await clerkClient.users.updateUserMetadata(user.id, {
  publicMetadata: { ...user.publicMetadata, role: "admin" },
});
process.stdout.write("Administrator role granted.\n");
