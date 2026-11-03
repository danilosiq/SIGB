"use client";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import type { User, View } from "@/core/@types";
import { Brand } from "@/core/components/brand";

type Item = { id: View; label: string; icon: LucideIcon };
export function LibrarySidebar({
  items,
  user,
  view,
  mobile,
  collapsed,
  dark,
  demo,
  unreadCount,
  onNavigate,
  onCollapse,
  onClose,
  onTheme,
  onLogout,
}: {
  items: Item[];
  user: User;
  view: View;
  mobile: boolean;
  collapsed: boolean;
  dark: boolean;
  demo: boolean;
  unreadCount: number;
  onNavigate: (view: View) => void;
  onCollapse: () => void;
  onClose: () => void;
  onTheme: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <aside
      className={`sidebar ${mobile ? "open" : ""}`}
      aria-label="Menu da biblioteca"
    >
      <div className="sidebar-header">
        <button
          className="sidebar-brand"
          aria-label="SIGB — explorar acervo"
          onClick={() => onNavigate("catalog")}
        >
          <Brand markOnly={collapsed && !mobile} />
        </button>
        <button
          className="icon-button sidebar-collapse"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          onClick={onCollapse}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <button
          className="icon-button sidebar-close"
          aria-label="Fechar menu"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <nav aria-label="Navegação principal">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? "active" : ""}`}
            title={label}
            aria-label={
              id === "notifications" && unreadCount
                ? `${label}: ${unreadCount} ${unreadCount === 1 ? "não lida" : "não lidas"}`
                : label
            }
            aria-current={view === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={20} />
            <span className="nav-label">{label}</span>
            {id === "notifications" && unreadCount > 0 && (
              <span className="nav-counter">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className={`sidebar-profile ${view === "profile" ? "active" : ""}`}
          title="Meu perfil"
          aria-label="Meu perfil"
          onClick={() => onNavigate("profile")}
        >
          <span className="avatar">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span className="sidebar-profile-label">
            <strong>{user.name}</strong>
            <small>Meu perfil</small>
          </span>
        </button>
        <div className="sidebar-utilities">
          <button
            className="icon-button"
            aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
            title={dark ? "Tema claro" : "Tema escuro"}
            onClick={onTheme}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {!demo && (
            <button
              className="icon-button"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
