"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Home,
  Heart,
  Network,
  FileText,
  MessageCircle,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  UserPlus,
  CheckSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [hasSpouse, setHasSpouse] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [hasPendingInvitation, setHasPendingInvitation] = useState(false);
  const [circleFamilyExpanded, setCircleFamilyExpanded] = useState(pathname?.startsWith("/circle-family"));
  const [hasHalaqahInvitation, setHasHalaqahInvitation] = useState(false);
  const [hasJoinRequests, setHasJoinRequests] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (
      !token &&
      !pathname?.startsWith("/auth") &&
      pathname !== "/" &&
      pathname !== "/invitations" &&
      !pathname?.startsWith("/invitations/")
    ) {
      router.push("/auth/login");
    }
  }, [pathname, router]);

  useEffect(() => {
    fetch("/api/taaruf")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHasSpouse(data?.has_spouse || false));
  }, []);

  const isAuthPage =
    pathname?.startsWith("/auth") ||
    pathname === "/" ||
    pathname === "/invitations";

  if (isAuthPage) {
    return children;
  }

  const taarufItem = !hasSpouse ? { href: "/taaruf", icon: Heart, label: "Ta'aruf" } : null;
  const navItems = [
    { href: "/feeds", icon: Home, label: "Family Feed" },
    { href: "/tree", icon: Network, label: "Family Tree" },
    ...(taarufItem ? [taarufItem] : []),
    { href: "/circle-family", icon: Users, label: "Circle Family", hasSubmenu: true },
    { href: "/documents", icon: FileText, label: "Family Vault" },
    { href: "/chat", icon: MessageCircle, label: "Messages" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const isChat = pathname?.startsWith("/chat");

  useEffect(() => {
    const fetchUnreadStatus = async () => {
      try {
        const res = await apiFetch("/api/chat/rooms");
        if (!res.ok) return;

        const rooms: any[] = await res.json();
        const hasAnyUnread = rooms.some((r) => (r.unread_count || 0) > 0);
        setHasUnreadChat(hasAnyUnread);
      } catch {
      }
    };

    fetchUnreadStatus();
  }, []);

  useEffect(() => {
    const fetchPendingInvitations = async () => {
      try {
        const res = await apiFetch("/api/invitations?status=pending");
        if (!res.ok) return;

        const data = await res.json();
        setHasPendingInvitation((data.invitations || []).length > 0);
      } catch {
      }
    };

    fetchPendingInvitations();

    const handler = () => fetchPendingInvitations();
    window.addEventListener("invitations-updated", handler);

    return () => {
      window.removeEventListener("invitations-updated", handler);
    };
  }, []);

  useEffect(() => {
    const fetchHalaqahInvitations = async () => {
      try {
        const res = await apiFetch("/api/circle-family/invitations?status=pending");
        if (!res.ok) return;

        const data = await res.json();
        setHasHalaqahInvitation((data.invitations || []).length > 0);
      } catch {
      }
    };

    fetchHalaqahInvitations();

    const handler = () => fetchHalaqahInvitations();
    window.addEventListener("halaqah-invitations-updated", handler);

    return () => {
      window.removeEventListener("halaqah-invitations-updated", handler);
    };
  }, []);

  useEffect(() => {
    const fetchJoinRequests = async () => {
      try {
        const res = await apiFetch("/api/circle-family/requests?status=pending");
        if (!res.ok) return;

        const data = await res.json();
        setHasJoinRequests((data.requests || []).length > 0);
      } catch {
      }
    };

    fetchJoinRequests();

    const handler = () => fetchJoinRequests();
    window.addEventListener("halaqah-requests-updated", handler);

    return () => {
      window.removeEventListener("halaqah-requests-updated", handler);
    };
  }, []);

  const isCircleFamilyPage = pathname?.startsWith("/circle-family");
  const isDiscoverSkillPage = pathname?.startsWith("/circle-family/discover/skill");
  const isCircleFamilyInvitationPage = pathname?.startsWith("/invitations/circle-family");

  const circleFamilySubItems = [
    { href: "/circle-family/discover/skill", icon: Search, label: "Cari Keluarga" },
    { href: "/circle-family", icon: Users, label: "Grup Saya" },
    { href: "/circle-family/requests", icon: CheckSquare, label: "Permintaan Bergabung" },
    { href: "/invitations/circle-family", icon: UserPlus, label: "Undangan Masuk" },
  ];

  const renderNavItems = () => (
    <div className="space-y-1">
      {navItems.map((item) => {
        if (item.hasSubmenu) {
          const isParentActive = isCircleFamilyPage || isDiscoverSkillPage || isCircleFamilyInvitationPage;
          return (
            <div key={item.href}>
              <button
                onClick={() => setCircleFamilyExpanded(!circleFamilyExpanded)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm rounded-lg font-medium transition-all ${
                  isParentActive
                    ? "bg-[#D6EAD9] text-[#2E5239]"
                    : "text-[#6B5B45] hover:bg-[#D6EAD9] hover:text-[#2E5239]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </div>
                <div className="flex items-center">
                  {(hasHalaqahInvitation || hasJoinRequests) && (
                    <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
                  )}
                  {circleFamilyExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div
>
              </button>

              {circleFamilyExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {circleFamilySubItems.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition-all ${
                        pathname === subItem.href
                          ? "bg-[#EDE4D3] text-[#3B2F1E]"
                          : "text-[#6B5B45] hover:bg-[#EDE4D3] hover:text-[#3B2F1E]"
                      }`}
                    >
                      <subItem.icon className="h-4 w-4" />
                      {subItem.label}
                      {subItem.href === "/invitations/circle-family" && hasHalaqahInvitation && (
                        <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                      )}
                      {subItem.href === "/circle-family/requests" && hasJoinRequests && (
                        <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg font-medium transition-all ${
              pathname === item.href
                ? "bg-[#D6EAD9] text-[#2E5239]"
                : "text-[#6B5B45] hover:bg-[#D6EAD9] hover:text-[#2E5239]"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}

            {item.href === "/chat" && hasUnreadChat && (
              <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
            )}

            {item.href === "/tree" && hasPendingInvitation && (
              <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F5F0E8] overflow-hidden">
      <header className="bg-[#FDFAF5] border-b border-[#D4C4A8] flex-shrink-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/feeds" className="flex items-center space-x-2">
              <img
                src="/images/logo-cerita-keluarga.png"
                alt="logo"
                className="mx-auto my-4 w-20 h-20 object-contain"
              />
              <span className="font-bold text-2xl text-[#3B2F1E]">
                Cerita Keluarga
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-[#6B5B45] hover:bg-[#EDE4D3] transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#6B5B45] hover:bg-[#EDE4D3] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div
        className={[
          "flex flex-1 min-h-0 container mx-auto w-full",
          isChat ? "p-0 gap-0" : "px-4 py-6 gap-6",
        ].join(" ")}
      >
        <nav
          className={[
            "w-56 flex-shrink-0 md:block transition-all duration-300",
            mobileMenuOpen ? "block" : "hidden",
            isChat ? "px-4 py-6" : "",
          ].join(" ")}
        >
          <div className="bg-[#FDFAF5] rounded-xl border border-[#D4C4A8] p-4 shadow-sm">
            {renderNavItems()}
          </div>
        </nav>

        <nav
          className={`fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 md:hidden ${
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute left-0 top-0 h-full w-56 bg-[#FDFAF5] border-r border-[#D4C4A8] p-4">
            {renderNavItems()}
          </div>
        </nav>

        <main
          className={[
            "flex-1 min-h-0 overflow-hidden flex flex-col",
            isChat ? "" : "py-0",
          ].join(" ")}
        >
          {children}
        </main>
      </div>
    </div>
  );
}