// src/components/team-switcher.tsx
"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link"; // Importar Link do Next.js para o botão "Criar Nova Organização"
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Importar AvatarImage
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface Team {
  id: string; // Adicionado ID para identificação única
  name: string;
  logo?: string; // Alterado de LucideIcon para string (URL)
  plan: string; // Assumindo que o plano é uma propriedade da organização ou é injetado
}

interface TeamSwitcherProps {
  teams: Team[];
  initialActiveTeam?: Team | null; // Nova prop para a equipe ativa inicial
  onTeamChange: (team: Team) => void; // Nova prop para notificar a mudança
}

export function TeamSwitcher({
  teams,
  initialActiveTeam,
  onTeamChange,
}: TeamSwitcherProps) {
  const { isMobile } = useSidebar();
  // Inicializa activeTeam com initialActiveTeam, ou a primeira equipe, ou null
  const [activeTeam, setActiveTeam] = React.useState<Team | null>(
    initialActiveTeam || teams[0] || null,
  );

  // Atualiza activeTeam se a prop initialActiveTeam mudar (ex: após a busca de dados)
  React.useEffect(() => {
    if (initialActiveTeam && initialActiveTeam.id !== activeTeam?.id) {
      setActiveTeam(initialActiveTeam);
    } else if (!initialActiveTeam && teams.length > 0 && !activeTeam) {
      // Se initialActiveTeam for nulo mas as equipes forem carregadas, define a primeira
      setActiveTeam(teams[0]);
    }
  }, [initialActiveTeam, activeTeam, teams]);

  const handleSelectTeam = (team: Team) => {
    setActiveTeam(team);
    onTeamChange(team); // Notifica o componente pai da mudança
  };

  // Exibe um placeholder ou retorna nulo se nenhuma equipe ativa estiver definida ainda
  if (!activeTeam) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="justify-center">
            <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <span className="text-xs">...</span>
            </div>
            {!isMobile && (
              <span className="flex-grow truncate text-sm font-semibold">
                Carregando organizações...
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Avatar className="h-6 w-6">
                  {activeTeam.logo ? ( // Renderização condicional para o logo (URL)
                    <AvatarImage
                      src={activeTeam.logo}
                      alt={activeTeam.name}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-transparent text-inherit">
                      {activeTeam.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              {/* Só mostra o texto quando não está colapsado (ou no mobile se a sidebar estiver expandida) */}
              {!isMobile && (
                <span className="flex-grow truncate text-sm font-semibold">
                  {activeTeam.name}
                </span>
              )}
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuLabel>Minhas Organizações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id} // Usa team.id como chave
                className="cursor-pointer"
                onSelect={() => handleSelectTeam(team)}
              >
                <Avatar className="mr-2 h-5 w-5">
                  {team.logo ? (
                    <AvatarImage
                      src={team.logo}
                      alt={team.name}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-transparent text-inherit">
                      {team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span>{team.name}</span>
                {team.id === activeTeam.id && ( // Indica a equipe ativa
                  <span className="text-muted-foreground ml-auto text-xs">
                    Ativa
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {/* Usar Link do Next.js para navegação */}
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/organizations/create">
                <Plus className="mr-2 h-4 w-4" />
                Criar Nova Organização
                <DropdownMenuShortcut>⇧⌘N</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
