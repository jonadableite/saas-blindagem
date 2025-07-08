// src/app/(protected)/organizations/create/page.tsx

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PageContainer,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { db } from "@/db";
import { usersTables } from "@/db/schema";
import { auth } from "@/lib/auth";

import { CreateOrganizationForm } from "./_components/create-organization-form";

const CreateOrganizationsPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user?.id) {
    redirect("/authentication");
  }

  const dbUser = await db.query.usersTables.findFirst({
    where: eq(usersTables.id, session.user.id),
  });

  if (!dbUser) {
    redirect("/authentication");
  }

  // TODO: Implementar a lógica para verificar o plano do usuário
  // Exemplo: const subscription = await getSubscription(dbUser.id);
  // const canCreateOrganization = subscription.plan === "pro";
  // Por enquanto, vamos assumir que qualquer usuário pode criar, ou você pode implementar a lógica real.
  const canCreateOrganization = true; // Substitua pela sua lógica de permissão (ex: baseada no plano)

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Criar Nova Organização</PageTitle>
          <PageDescription>
            Crie uma nova organização para gerenciar seus projetos e equipes.
          </PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Organização</CardTitle>
            <CardDescription>
              Preencha os campos para criar sua nova organização.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm
              canCreateOrganization={canCreateOrganization}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default CreateOrganizationsPage;
