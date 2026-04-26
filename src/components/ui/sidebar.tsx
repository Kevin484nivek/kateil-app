"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarItem = {
  href: Route;
  icon: string;
  label: string;
  description: string;
};

type SidebarProps = {
  logoutAction: (formData: FormData) => void | Promise<void>;
  sessionName: string;
};

const items: SidebarItem[] = [
  { href: "/dashboard", icon: "◧", label: "Dashboard", description: "Resumen del negocio" },
  { href: "/sales/new", icon: "€", label: "Nueva venta", description: "TPV y venta rápida" },
  { href: "/sales/history", icon: "◴", label: "Histórico", description: "Ventas y tickets" },
  { href: "/products", icon: "▦", label: "Productos", description: "Stock, filtros y catálogo" },
  { href: "/inventory-entries", icon: "▤", label: "Mercancía", description: "Entradas y pedidos" },
  { href: "/expenses", icon: "◫", label: "Finanzas", description: "Gastos, ingresos y recurrencias" },
  { href: "/stock-movements", icon: "↻", label: "Movimientos", description: "Trazabilidad" },
  { href: "/suppliers", icon: "◈", label: "Proveedores", description: "Relación y comisiones" },
  { href: "/customers", icon: "◍", label: "Clientes", description: "Histórico y notas" },
  { href: "/users", icon: "◉", label: "Usuarios", description: "Accesos internos" },
];

export function Sidebar({ logoutAction, sessionName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const tabletQuery = window.matchMedia("(max-width: 1280px)");

    const syncCollapsed = () => {
      setCollapsed(tabletQuery.matches);
    };

    syncCollapsed();
    tabletQuery.addEventListener("change", syncCollapsed);

    return () => {
      tabletQuery.removeEventListener("change", syncCollapsed);
    };
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <p className="sidebar-eyebrow">Kateil</p>
          <h1>{collapsed ? "K" : "Platform"}</h1>
          {!collapsed ? (
            <p className="sidebar-supporting">
              Un núcleo modular para operar clientes desde una sola plataforma.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
          aria-pressed={collapsed}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Principal">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              {!collapsed ? <span className="sidebar-link-label">{item.label}</span> : null}
              {!collapsed ? <small>{item.description}</small> : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-session">
          <p className="card-label">Sesión activa</p>
          {!collapsed ? <strong>{sessionName}</strong> : <strong>Activa</strong>}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="button button-secondary sidebar-logout">
            {collapsed ? "Salir" : "Cerrar sesión"}
          </button>
        </form>
      </div>
    </aside>
  );
}
