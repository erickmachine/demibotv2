"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { clearToken } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  Shield,
  AlertTriangle,
  Clock,
  Ban,
  Send,
  LogOut,
  Settings,
  Terminal,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/groups", label: "Grupos", icon: Users },
  { href: "/dashboard/rentals", label: "Alugueis", icon: Clock },
  { href: "/dashboard/blacklist", label: "Lista Negra", icon: Ban },
  { href: "/dashboard/broadcast", label: "Broadcast", icon: Send },
  { href: "/dashboard/warnings", label: "Advertencias", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Configuracoes", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    clearToken()
    router.push("/")
  }

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-card min-h-screen">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">DEMI BOT</h2>
          <p className="text-xs text-muted-foreground font-mono">v1.0.0</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-secondary/50">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground truncate">129.121.38.161</span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
