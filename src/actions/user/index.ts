// src/actions/user/index.ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { User, usersTables } from "@/db/schema";
import { auth } from "@/lib/auth";

interface UpdateAccountState {
  message: string;
  success: boolean;
  errors?: string;
}

export async function updateAccountSettings(
  prevState: UpdateAccountState,
  formData: FormData
): Promise<UpdateAccountState> {
  try {
    const name = formData.get("name") as string;
    const image = formData.get("image") as string;
    const timezone = formData.get("timezone") as string;

    const currentUser = await auth.api.getSession();
    if (!currentUser) {
      return { message: "Usuário não autenticado.", success: false };
    }

    const updateFields: Partial<User> = {};

    // Verifica e adiciona campos para atualização apenas se houver mudança
    if (name !== undefined && name !== currentUser.name) {
      updateFields.name = name;
    }
    if (image !== undefined && image !== currentUser.image) {
      updateFields.image = image;
    }
    if (timezone !== undefined && timezone !== currentUser.timezone) {
      updateFields.timezone = timezone;
    }

    if (Object.keys(updateFields).length === 0) {
      return { message: "Nenhuma alteração para salvar.", success: true };
    }

    // Realiza a atualização no banco de dados usando Drizzle ORM
    await db
      .update(usersTables)
      .set({
        ...updateFields,
        updatedAt: new Date(), // Atualiza o timestamp de `updatedAt`
      })
      .where(eq(usersTables.id, currentUser.id));

    // Revalida o cache da página para mostrar os dados atualizados imediatamente
    revalidatePath("/conta");

    return { message: "Configurações atualizadas com sucesso!", success: true };
  } catch (error: any) {
    console.error("Falha ao atualizar configurações da conta:", error);
    return {
      message: "Falha ao atualizar configurações: " + error.message,
      success: false,
      errors: error.errors,
    };
  }
}

// Nota sobre alteração de email:
// Better Auth tem um fluxo específico para alteração de email (authClient.changeEmail)
// que geralmente envolve verificação por email. Isso não é feito diretamente
// via `updateUser` ou esta Server Action para manter a segurança.
// Uma função separada seria necessária para isso.

// Nota sobre alteração de senha e exclusão de conta:
// Better Auth também tem métodos específicos para isso (authClient.changePassword, authClient.deleteUser).
// Estes também exigiriam fluxos separados, possivelmente com interações no cliente
// ou Server Actions dedicadas para chamar `auth.api.setPassword` ou `auth.api.deleteUser`.
