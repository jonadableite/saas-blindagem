// src/app/(protected)/_components/app-sidebar.tsx
"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, LayoutDashboard, Sparkles, Users } from "lucide-react";
// Importe os ícones Lucide necessários para os logos das organizações
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  LucideIcon,
} from "lucide-react"; // Import LucideIcon type
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { FaWhatsapp } from "react-icons/fa";

import Logo from "@/components/logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Define um mapeamento de nomes de ícones (strings) para os componentes Lucide Icon reais
// NOTA: Este mapa não é diretamente usado para logos de organização do better-auth,
// pois o better-auth fornece o logo como uma string de URL. Se você pretende mapear
// uma string de metadados da organização para um LucideIcon, você precisaria implementar essa lógica.
const lucideIconMap: { [key: string]: LucideIcon } = {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  // Adicione outros ícones conforme necessário para as organizações
};

// Define a interface para a equipe/organização para tipagem consistente
// Ajustado 'logo' para ser string (URL) conforme a estrutura da organização do better-auth
// Adicionado 'slug' pois faz parte do objeto de organização do better-auth
interface OrganizationTeam {
  id: string;
  name: string;
  slug: string; // Adicionado slug
  logo?: string; // Alterado para string para URL
  // NOTA: 'plan' não é diretamente fornecido pelo objeto de organização do better-auth.
  // Isso pode precisar ser buscado separadamente ou derivado com base na assinatura do usuário
  // para a organização específica. Por enquanto, usaremos o plano global do usuário ou um placeholder.
  plan: string;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const session = authClient.useSession();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [displayedPlan, setDisplayedPlan] = React.useState("");

  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Buscar as organizações das quais o usuário é membro
  const { data: organizations, isLoading: loadingOrganizations } =
    authClient.useListOrganizations();

  // Buscar a organização atualmente ativa
  const { data: activeOrganization, isLoading: loadingActiveOrganization } =
    authClient.useActiveOrganization();

  // Estado para armazenar a organização ativa atual para o TeamSwitcher
  const [currentActiveOrganization, setCurrentActiveOrganization] =
    React.useState<OrganizationTeam | null>(null);

  // Efeito para definir a organização ativa inicial e o plano exibido assim que os dados são carregados
  React.useEffect(() => {
    if (isMounted && activeOrganization && !loadingActiveOrganization) {
      // Mapear a activeOrganization para o formato OrganizationTeam, incluindo um placeholder para 'plan'
      const activeOrgMapped: OrganizationTeam = {
        id: activeOrganization.id,
        name: activeOrganization.name,
        slug: activeOrganization.slug,
        logo: activeOrganization.logo,
        // Usando o plano global do usuário como um placeholder para o plano da organização.
        // Isso pode precisar de refinamento se os planos forem verdadeiramente específicos da organização.
        plan: session.data?.user?.plan || "Free",
      };
      setCurrentActiveOrganization(activeOrgMapped);
      setDisplayedPlan(activeOrgMapped.plan);
    } else if (isMounted && !activeOrganization && !loadingActiveOrganization) {
      // Se nenhuma organização ativa for definida, use o plano do usuário como padrão
      setDisplayedPlan(session.data?.user?.plan || "Free");
    }
  }, [
    isMounted,
    activeOrganization,
    loadingActiveOrganization,
    session.data?.user?.plan,
  ]);

  console.log("Sidebar isCollapsed:", isCollapsed);

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/authentication");
        },
      },
    });
  };

  // Mapear as organizações buscadas para a interface OrganizationTeam
  const fetchedOrganizations: OrganizationTeam[] = React.useMemo(() => {
    if (!organizations) return [];
    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo, // Isso será uma string de URL
      // Atribuindo o plano global do usuário. Isso pode precisar de lógica personalizada
      // se cada organização tiver um plano distinto associado ao usuário.
      plan: session.data?.user?.plan || "Free",
    }));
  }, [organizations, session.data?.user?.plan]);

  // Manipulador para quando a organização ativa muda no TeamSwitcher
  const handleOrganizationChange = async (newOrg: OrganizationTeam) => {
    setCurrentActiveOrganization(newOrg);
    setDisplayedPlan(newOrg.plan); // Atualizar o plano exibido com base no plano (placeholder) da organização selecionada

    // Atualizar a organização ativa na sessão do usuário via better-auth
    try {
      await authClient.organization.setActive({
        organizationId: newOrg.id,
      });
      console.log("Organização ativa alterada para:", newOrg.name);
      // Opcionalmente, atualize a sessão ou os dados, se necessário, após definir a organização ativa
      // authClient.invalidateSession(); // Isso pode causar uma re-renderização completa, use com cautela.
    } catch (error) {
      console.error("Falha ao definir a organização ativa:", error);
    }
  };

  const userRoles = session.data?.user?.role || "";
  const isSuperAdmin = userRoles.split(",").includes("superadmin");

  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "WhatsApp",
      url: "/whatsapp",
      icon: FaWhatsapp,
      items: [
        {
          title: "Instâncias",
          url: "/whatsapp/instancia",
        },
      ],
    },
  ];

  const userData = {
    name: session.data?.user?.name || "",
    email: session.data?.user?.email || "",
    avatar: session.data?.user?.image || "",
    plan: displayedPlan, // Agora vem do estado 'displayedPlan'
    dailyMessageLimit: session.data?.user?.dailyMessageLimit,
    monthlyMessageLimit: session.data?.user?.monthlyMessageLimit,
  };
  if (!userData.name) {
    userData.name = session.data?.user?.email || "Usuário sem nome";
  }

  return (
    <Sidebar collapsible="icon" className="w-[260px]" {...props}>
      <SidebarHeader>
        <div
          className={`flex items-center ${isCollapsed ? "justify-center p-2" : "gap-3 p-2"}`}
        >
          <AnimatePresence mode="wait">
            {isCollapsed ? (
              <motion.div
                key="logo-collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Logo variant="icon" className="h-8 w-8 min-w-[32px]" />
              </motion.div>
            ) : (
              <motion.div
                key="logo-expanded"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Logo variant="icon" className="h-12 w-12 min-w-[48px]" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                key="text-content"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-grow flex-col items-start overflow-hidden"
              >
                <motion.span
                  className="text-foreground text-2xl font-semibold whitespace-nowrap"
                  animate={{
                    scale: [1, 1.01, 1],
                    filter: [
                      "drop-shadow(0px 0px 0px rgba(255, 255, 255, 0))",
                      "drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.4))",
                      "drop-shadow(0px 0px 0px rgba(255, 255, 255, 0))",
                    ],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.8,
                  }}
                >
                  WhatLead
                </motion.span>
                <div className="relative mt-1 self-start overflow-hidden rounded-full p-[1.5px]">
                  <motion.div
                    className="absolute inset-0 z-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0%, transparent 60%, #a78bfa 75%, #a78bfa 85%, transparent 100%)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <div className="relative z-10 flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0 backdrop-blur-sm">
                    <span className="text-foreground text-sm font-light">
                      Plano atual:
                    </span>
                    <span className="text-primary text-xs font-bold whitespace-nowrap">
                      {displayedPlan}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Nova seção para seleção de organização */}
        <SidebarGroup className="mt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <SidebarGroupLabel className="text-muted-foreground/80 text-sm font-semibold">
              Organizações
            </SidebarGroupLabel>
          </motion.div>
          {loadingOrganizations || loadingActiveOrganization ? ( // Verifica ambos os estados de carregamento
            // Exibir um estado de carregamento enquanto as organizações são buscadas
            <div className="text-muted-foreground p-2 text-sm">
              Carregando organizações...
            </div>
          ) : (
            <TeamSwitcher
              teams={fetchedOrganizations}
              initialActiveTeam={currentActiveOrganization}
              onTeamChange={handleOrganizationChange}
            />
          )}
        </SidebarGroup>

        <NavMain items={navMain} />

        {/* Novo SidebarGroup para "Outros" e os botões de Upgrade e Super Admin */}
        <SidebarGroup className="mt-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <SidebarGroupLabel className="text-muted-foreground/80 text-sm font-semibold">
              Outros
            </SidebarGroupLabel>
          </motion.div>
          <Link
            href="/subscription"
            className={cn(
              "relative block w-full overflow-hidden rounded-lg bg-gradient-to-r from-[#1e1b4a] to-[#0D0D0D]",
              "group transition-all duration-300 hover:shadow-lg",
              "upgrade-button-shimmer",
              "mt-4",
            )}
          >
            <AnimatePresence mode="wait">
              {isCollapsed ? (
                <motion.div
                  key="upgrade-collapsed"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-center p-3">
                    <Crown className="h-6 w-6 text-yellow-400" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="upgrade-expanded"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 p-3"
                >
                  <Crown className="h-6 w-6 text-yellow-400" />
                  <span className="flex-grow text-sm font-semibold text-white">
                    Upgrade de Plano
                  </span>
                  <Sparkles className="h-4 w-4 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          {isSuperAdmin && (
            <Link
              href="/admin"
              className={cn(
                "relative block w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-700 to-blue-900",
                "group transition-all duration-300 hover:shadow-lg",
                "mt-2",
              )}
            >
              <AnimatePresence mode="wait">
                {isCollapsed ? (
                  <motion.div
                    key="admin-collapsed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-center p-3">
                      <Users className="h-6 w-6 text-blue-300" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="admin-expanded"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3"
                  >
                    <Users className="h-6 w-6 text-blue-300" />
                    <span className="flex-grow text-sm font-semibold text-white">
                      Admin
                    </span>
                    <Sparkles className="h-4 w-4 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={handleSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
