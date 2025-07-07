// src/app/(protected)/conta/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  PageContainer,
  PageContent,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageTitle,
} from "@/components/ui/page-container";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";

import PlanInfo from "./_components/PlanInfo";
// Componentes Cliente para interatividade
import ProfileForm from "./_components/ProfileForm";
import SettingsForm from "./_components/SettingsForm";

const ContaPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/authentication");
  }

  const user = session.user;

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>Conta</PageTitle>
          <PageDescription>Gerencie as informações do seu perfil, configurações e plano.</PageDescription>
        </PageHeaderContent>
      </PageHeader>
      <PageContent className="space-y-8">
        {/* Seção de Perfil */}
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Atualize seu nome, foto de perfil e endereço de e-mail.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} />
          </CardContent>
        </Card>

        {/* Seção de Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>Gerencie as configurações gerais da sua conta, como fuso horário e tema.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm user={user} />
          </CardContent>
        </Card>

        {/* Seção de Plano e Assinatura */}
        <Card>
          <CardHeader>
            <CardTitle>Plano e Assinatura</CardTitle>
            <CardDescription>Visualize os detalhes do seu plano atual e limites de uso.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanInfo user={user} />
          </CardContent>
        </Card>

        {/* Seção de Segurança (Opcional, pode ser um link para outra página ou modal) */}
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Gerencie suas credenciais e sessões ativas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Alterar Senha</Label>
                <p className="text-sm text-muted-foreground">
                  Se você usa e-mail e senha, clique para alterar sua senha.
                </p>
                <Button variant="outline" className="mt-2">Alterar Senha</Button>
              </div>
              <Separator />
              <div>
                <Label>Sessões Ativas</Label>
                <p className="text-sm text-muted-foreground">
                  Visualize e gerencie os dispositivos onde sua conta está conectada.
                </p>
                <Button variant="outline" className="mt-2">Ver Sessões</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </PageContainer>
  );
};

export default ContaPage;
