//src/app/(protected)/organizations/create/_components/create-organization-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

// Importações dos componentes de UI (ajuste os caminhos conforme sua estrutura)
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// 1. Defina o schema Zod para o formulário
const formSchema = z.object({
  name: z.string().min(1, "O nome da organização é obrigatório."),
  slug: z
    .string()
    .min(1, "O slug é obrigatório.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "O slug deve conter apenas letras minúsculas, números e hífens, e não pode começar ou terminar com hífen.",
    ),
  logo: z.string().url("URL do logo inválida.").optional().or(z.literal("")), // Permite URL ou string vazia
});

// 2. Use o schema Zod para inferir o tipo dos valores do formulário
type CreateOrganizationFormValues = z.infer<typeof formSchema>;

interface CreateOrganizationFormProps {
  canCreateOrganization: boolean;
}

export function CreateOrganizationForm({
  canCreateOrganization,
}: CreateOrganizationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateOrganizationFormValues>({
    // 3. Passe o schema Zod para o zodResolver
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      logo: "",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: CreateOrganizationFormValues) {
    setIsSubmitting(true);
    try {
      const newOrg = await authClient.organization.create({
        name: values.name,
        slug: values.slug,
        logo: values.logo || undefined, // Envia undefined se o logo for uma string vazia
      });

      toast.success(`Organização "${newOrg.name}" criada com sucesso!`);
      await authClient.organization.setActive({ organizationId: newOrg.id });
      router.push(`/dashboard`);
    } catch (error: any) {
      console.error("Erro ao criar organização:", error);
      toast.error(
        error.message || "Falha ao criar organização. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canCreateOrganization) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-center">
          Seu plano atual não permite a criação de novas organizações. Por
          favor, faça um upgrade para continuar.
          <div className="mt-4">
            <Button onClick={() => router.push("/subscription")}>
              Upgrade de Plano
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Organização</FormLabel>
                  <FormControl>
                    <Input placeholder="Minha Empresa SaaS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug da Organização</FormLabel>
                  <FormControl>
                    <Input placeholder="minha-empresa-saas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Logo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/logo.png"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar Organização"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
