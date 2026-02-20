"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { clearToken } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
  Menu,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/dashboard/groups", label: "Grupos", icon: Users },
  { href: "/dashboard/rentals", label: "Alugueis", icon: Clock },
  { href: "/dashboard/blacklist", label: "Lista Negra", icon: Ban },
  { href: "/dashboard/broadcast", label: "Broadcast", icon: Send },
  { href: "/dashboard/warnings", label: "Advertencias", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Configuracoes", icon: Settings },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    clearToken()
    router.push("/")
  }

  return (
    <header className="lg:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <span className="text-sm font-bold text-foreground">DEMI BOT</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-card border-border p-0">
          <SheetHeader className="px-6 py-5 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              DEMI BOT
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
          <div className="mt-auto p-3 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
