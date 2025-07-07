// src/app/(protected)/whatsapp/components/whatsapp-client-page.tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { CreateInstanceForm } from "./create-instance-form";
import { Instance, InstanceList } from "./instance-list";

interface WhatsappClientPageProps {
  initialInstances: Instance[];
}

export function WhatsappClientPage({
  initialInstances,
}: WhatsappClientPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">
          Gerenciar Instâncias de WhatsApp
        </h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="magic" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância de WhatsApp</DialogTitle>
            </DialogHeader>
            <CreateInstanceForm onClose={() => setIsModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <InstanceList initialInstances={initialInstances} />
    </div>
  );
}
