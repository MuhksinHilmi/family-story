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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (
      !token &&
      !pathname?.startsWith("/auth") &&
      !pathname?.startsWith("/invitations") &&
      pathname !== "/"
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
    pathname?.startsWith("/invitations") ||
    pathname === "/";

  if (isAuthPage) {
    return children;
  }

  const taarufItem = !hasSpouse ? { href: "/taaruf", icon: Heart, label: "Ta'aruf" } : null;
  const navItems = [
    { href: "/feeds", icon: Home, label: "Feeds" },
    { href: "/tree", icon: Network, label: "Pohon Keluarga" },
    ...(taarufItem ? [taarufItem] : []),
    { href: "/documents", icon: FileText, label: "Dokumen" },
    { href: "/chat", icon: MessageCircle, label: "Chat" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
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
              className="text-[#6B5B45] hover:bg-[#EDE4D3]"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#6B5B45] hover:bg-[#EDE4D3]"
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
            <div className="space-y-1">
              {navItems.map((item) => (
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
              ))}
            </div>
          </div>
        </nav>

        <nav
          className={`fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300 md:hidden ${
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute left-0 top-0 h-full w-56 bg-[#FDFAF5] border-r border-[#D4C4A8] p-4">
            <div className="space-y-1">
              {navItems.map((item) => (
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
              ))}
            </div>
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