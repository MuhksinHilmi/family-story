"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Heart,
  Network,
  FileText,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  UserPlus,
  CheckSquare,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

type NavItem =
  | { href: string; icon: React.ElementType; label: string; hasSubmenu?: false }
  | { href: string; icon: React.ElementType; label: string; hasSubmenu: true };

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [hasSpouse, setHasSpouse] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [hasPendingInvitation, setHasPendingInvitation] = useState(false);
  const [circleFamilyExpanded, setCircleFamilyExpanded] = useState(
    pathname?.startsWith("/circle-family") ?? false,
  );
  const [hasHalaqahInvitation, setHasHalaqahInvitation] = useState(false);
  const [hasJoinRequests, setHasJoinRequests] = useState(false);

  // Auth gate
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

  // Taaruf check
  useEffect(() => {
    fetch("/api/taaruf")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHasSpouse(data?.has_spouse || false));
  }, []);

  // Unread chat
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await apiFetch("/api/chat/rooms");
        if (!res.ok) return;
        const rooms: { unread_count?: number }[] = await res.json();
        setHasUnreadChat(rooms.some((r) => (r.unread_count || 0) > 0));
      } catch {
        /* silent */
      }
    };
    fetchUnread();
  }, []);

  // Pending invitations
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await apiFetch("/api/invitations?status=pending");
        if (!res.ok) return;
        const data = await res.json();
        setHasPendingInvitation((data.invitations || []).length > 0);
      } catch {
        /* silent */
      }
    };
    fetchPending();
    const handler = () => fetchPending();
    window.addEventListener("invitations-updated", handler);
    return () => window.removeEventListener("invitations-updated", handler);
  }, []);

  // Halaqah invitations
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await apiFetch(
          "/api/circle-family/invitations?status=pending",
        );
        if (!res.ok) return;
        const data = await res.json();
        setHasHalaqahInvitation((data.invitations || []).length > 0);
      } catch {
        /* silent */
      }
    };
    fetch_();
    const h = () => fetch_();
    window.addEventListener("halaqah-invitations-updated", h);
    return () => window.removeEventListener("halaqah-invitations-updated", h);
  }, []);

  // Join requests
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await apiFetch(
          "/api/circle-family/requests?status=pending",
        );
        if (!res.ok) return;
        const data = await res.json();
        setHasJoinRequests((data.requests || []).length > 0);
      } catch {
        /* silent */
      }
    };
    fetch_();
    const h = () => fetch_();
    window.addEventListener("halaqah-requests-updated", h);
    return () => window.removeEventListener("halaqah-requests-updated", h);
  }, []);

  // ── routing guards ──────────────────────────────
  const isAuthPage =
    pathname?.startsWith("/auth") ||
    pathname === "/" ||
    pathname === "/invitations";

  if (isAuthPage) return <>{children}</>;

  const isChat = pathname?.startsWith("/chat");

  // ── nav items ───────────────────────────────────
  const navItems: NavItem[] = [
    { href: "/feeds", icon: Home, label: "Family Feed" },
    { href: "/tree", icon: Network, label: "Family Tree" },
    ...(!hasSpouse
      ? [{ href: "/taaruf", icon: Heart, label: "Ta'aruf" } as NavItem]
      : []),
    {
      href: "/circle-family",
      icon: Users,
      label: "Circle Family",
      hasSubmenu: true,
    },
    { href: "/documents", icon: FileText, label: "Family Vault" },
    { href: "/chat", icon: MessageCircle, label: "Messages" },
    { href: "/notifications", icon: Bell, label: "Notifikasi" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
  ];

  const circleFamilySubItems = [
    {
      href: "/circle-family/discover/skill",
      icon: Search,
      label: "Cari Keluarga",
    },
    { href: "/circle-family", icon: Users, label: "Grup Saya" },
    { href: "/circle-family/requests", icon: CheckSquare, label: "Permintaan" },
    {
      href: "/invitations/circle-family",
      icon: UserPlus,
      label: "Undangan Masuk",
    },
  ];

  const isCircleFamilyPage =
    pathname?.startsWith("/circle-family") ||
    pathname?.startsWith("/invitations/circle-family");

  // ── helpers ─────────────────────────────────────
  const userInitial = user?.full_name?.[0]?.toUpperCase() || "U";
  const userName = user?.full_name?.split(" ")[0] || "User";

  const renderNavItems = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {navItems.map((item) => {
        if ("hasSubmenu" in item && item.hasSubmenu) {
          const isActive = isCircleFamilyPage;
          return (
            <div key={item.href}>
              <button
                onClick={() => setCircleFamilyExpanded(!circleFamilyExpanded)}
                className="ck-sidebar-item"
                data-active={isActive ? "true" : undefined}
                aria-expanded={circleFamilyExpanded}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <item.icon size={17} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {(hasHalaqahInvitation || hasJoinRequests) && (
                  <span className="ck-sidebar-dot" />
                )}
                {circleFamilyExpanded ? (
                  <ChevronDown size={14} style={{ opacity: 0.5 }} />
                ) : (
                  <ChevronRight size={14} style={{ opacity: 0.5 }} />
                )}
              </button>

              {circleFamilyExpanded && (
                <div
                  style={{
                    paddingLeft: "1.625rem",
                    marginTop: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {circleFamilySubItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="ck-sidebar-sub"
                      data-active={pathname === sub.href ? "true" : undefined}
                    >
                      <sub.icon size={14} />
                      <span style={{ flex: 1 }}>{sub.label}</span>
                      {sub.href === "/invitations/circle-family" &&
                        hasHalaqahInvitation && (
                          <span className="ck-sidebar-dot" />
                        )}
                      {sub.href === "/circle-family/requests" &&
                        hasJoinRequests && <span className="ck-sidebar-dot" />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className="ck-sidebar-item"
            data-active={isActive ? "true" : undefined}
          >
            <item.icon size={17} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.href === "/chat" && hasUnreadChat && (
              <span className="ck-sidebar-dot" />
            )}
            {item.href === "/tree" && hasPendingInvitation && (
              <span className="ck-sidebar-dot" />
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ───── Sidebar CSS ───── */}
      <style>{`
        .ck-dash-layout {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--ck-dash-bg);
          overflow: hidden;
          font-family: var(--font-body);
        }

        /* Top bar */
        .ck-topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.25rem;
          background: var(--ck-dash-card);
          border-bottom: 1px solid var(--ck-dash-border);
          flex-shrink: 0;
          z-index: 50;
        }
        .ck-topbar-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
        }
        .ck-topbar-brand-logo {
          width: 28px;
          height: 28px;
          object-fit: contain;
          border-radius: 6px;
        }
        .ck-topbar-brand-name {
          font-family: var(--font-display);
          font-size: 1.0625rem;
          font-weight: 600;
          color: var(--ck-dash-text1);
          letter-spacing: 0.01em;
        }
        .ck-topbar-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .ck-topbar-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--ck-dash-text2);
          transition: background 0.15s;
        }
        .ck-topbar-btn:hover { background: var(--ck-dash-surface); }

        /* Body row */
        .ck-body-row {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        /* Sidebar */
        .ck-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--ck-dash-card);
          border-right: 1px solid var(--ck-dash-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .ck-sidebar { display: none; }
          .ck-sidebar.mobile-open {
            display: flex;
            position: fixed;
            inset: 0;
            width: 240px;
            z-index: 60;
            box-shadow: 4px 0 24px rgba(0,0,0,0.15);
          }
        }
        .ck-sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 0.75rem;
          scrollbar-width: none;
        }
        .ck-sidebar-nav::-webkit-scrollbar { display: none; }

        /* Section label */
        .ck-sidebar-section-label {
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ck-dash-text3);
          padding: 0.875rem 0.5rem 0.375rem;
        }

        /* Nav item */
        .ck-sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.5625rem 0.75rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--ck-dash-text2);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          position: relative;
        }
        .ck-sidebar-item:hover {
          background: var(--ck-dash-surface);
          color: var(--ck-dash-text1);
        }
        .ck-sidebar-item[data-active="true"] {
          background: var(--ck-dash-green-lt);
          color: var(--ck-dash-green-dk);
          font-weight: 600;
        }
        .ck-sidebar-item[data-active="true"]::before {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          height: 60%;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: var(--ck-dash-green);
        }

        /* Sub item */
        .ck-sidebar-sub {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4375rem 0.625rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--ck-dash-text3);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .ck-sidebar-sub:hover {
          background: var(--ck-dash-surface);
          color: var(--ck-dash-text2);
        }
        .ck-sidebar-sub[data-active="true"] {
          background: rgba(74,124,89,0.08);
          color: var(--ck-dash-green);
          font-weight: 600;
        }

        /* Dot badge */
        .ck-sidebar-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #E05252;
          flex-shrink: 0;
        }

        /* Sidebar footer */
        .ck-sidebar-footer {
          padding: 0.875rem 0.875rem;
          border-top: 1px solid var(--ck-dash-border);
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .ck-sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--ck-dash-green-lt);
          color: var(--ck-dash-green-dk);
          font-size: 0.8125rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ck-sidebar-username {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--ck-dash-text1);
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ck-sidebar-logout {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--ck-dash-text3);
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .ck-sidebar-logout:hover {
          background: #FDEAEA;
          color: #C0392B;
        }

        /* Main */
        .ck-main {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Mobile overlay */
        .ck-mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 55;
          background: rgba(0,0,0,0.45);
        }
        @media (max-width: 768px) {
          .ck-mobile-overlay.open { display: block; }
        }
      `}</style>

      <div className="ck-dash-layout">
        {/* ── Top bar ── */}
        <header className="ck-topbar">
          <Link href="/feeds" className="ck-topbar-brand">
            <img
              src="/images/logo-cerita-keluarga.png"
              alt="Cerita Keluarga"
              className="ck-topbar-brand-logo"
            />
            <span className="ck-topbar-brand-name">Cerita Keluarga</span>
          </Link>

          <div className="ck-topbar-right">
            {/* Mobile hamburger */}
            <button
              className="ck-topbar-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              style={{ display: "none" }}
              // inline style show on mobile via CSS is tricky; use className trick below
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Hamburger visible only on mobile — override via media query */}
            <style>{`
              @media (max-width: 768px) {
                .ck-mobile-hamburger { display: flex !important; }
              }
            `}</style>
            <button
              className="ck-topbar-btn ck-mobile-hamburger"
              style={{ display: "none" }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="ck-body-row">
          {/* Mobile overlay */}
          <div
            className={`ck-mobile-overlay${mobileMenuOpen ? " open" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* ── Sidebar ── */}
          <aside
            className={`ck-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}
          >
            <nav className="ck-sidebar-nav" aria-label="Navigasi utama">
              <p className="ck-sidebar-section-label">Menu</p>
              {renderNavItems()}
            </nav>

            {/* Footer: user + logout */}
            <div className="ck-sidebar-footer">
              <div className="ck-sidebar-avatar">{userInitial}</div>
              <span className="ck-sidebar-username">{userName}</span>
              <button
                className="ck-sidebar-logout"
                onClick={logout}
                title="Keluar"
                aria-label="Keluar dari akun"
              >
                <LogOut size={15} />
              </button>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main
            className="ck-main"
            style={isChat ? {} : { padding: "1.5rem", overflowY: "auto" }}
          >
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
