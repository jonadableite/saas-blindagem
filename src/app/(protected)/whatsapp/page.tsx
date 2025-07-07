// src/app/(protected)/whatsapp/page.tsx
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { instancesTables } from "@/db/schema";
import { auth } from "@/lib/auth";

import { WhatsappClientPage } from "./components/whatsapp-client-page";

export default async function WhatsappPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/authentication");
  }

  const userId = session.user.id;

  const userInstances = await db.query.instancesTables.findMany({
    where: eq(instancesTables.userId, userId),
    orderBy: instancesTables.createdAt,
  });

  return <WhatsappClientPage initialInstances={userInstances} />;
}
