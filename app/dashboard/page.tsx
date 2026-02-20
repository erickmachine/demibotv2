"use client"

import { useEffect, useState } from "react"
import { apiFetch, type BotStatus, type GroupInfo } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  Terminal as TerminalIcon,
  Clock,
  Zap,
  Activity,
} from "lucide-react"

function formatUptime(ms: number) {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${days}d ${hours}h ${mins}m`
}

export default function DashboardPage() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, g] = await Promise.all([
          apiFetch<BotStatus>("/api/bot/status"),
          apiFetch<GroupInfo[]>("/api/groups"),
        ])
        setStatus(s)
        setGroups(g)
      } catch {
        // Error handled by apiFetch redirect
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const activeGroups = groups.filter(
    (g) => g.rental && g.rental.active && !g.rental.isExpired
  ).length
  const totalMembers = groups.reduce((sum, g) => sum + g.members, 0)
  const expiringGroups = groups.filter((g) => {
    if (!g.rental || !g.rental.active || g.rental.isExpired) return false
    const remaining = g.rental.expireAt - Date.now()
    return remaining < 3 * 24 * 60 * 60 * 1000
  })

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel de Controle</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitore e gerencie o DEMI BOT em tempo real
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            {status?.connected ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                variant={status?.connected ? "default" : "destructive"}
                className={status?.connected ? "bg-primary/10 text-primary border-primary/20" : ""}
              >
                {status?.connected ? "Online" : "Offline"}
              </Badge>
              {status?.botNumber && (
                <span className="text-xs font-mono text-muted-foreground">{status.botNumber}</span>
              )}
            </div>
            {status?.uptime && (
              <p className="text-xs text-muted-foreground mt-2">
                Uptime: {formatUptime(status.uptime)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Grupos Ativos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{activeGroups}</p>
            <p className="text-xs text-muted-foreground mt-1">
              de {groups.length} grupos totais
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membros Totais</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalMembers.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              em todos os grupos
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comandos</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {(status?.stats?.commandsProcessed || 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(status?.stats?.messagesProcessed || 0).toLocaleString("pt-BR")} msgs processadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Groups */}
      {expiringGroups.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
              <Clock className="h-4 w-4" />
              Grupos Proximos da Expiracao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {expiringGroups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.members} membros</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {g.rental?.remaining}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Groups */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TerminalIcon className="h-4 w-4" />
            Grupos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum grupo encontrado. O bot precisa estar conectado.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.slice(0, 10).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.members} membros</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={g.rental && g.rental.active && !g.rental.isExpired ? "default" : "secondary"}
                      className={
                        g.rental && g.rental.active && !g.rental.isExpired
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-muted-foreground"
                      }
                    >
                      {g.rental && g.rental.active && !g.rental.isExpired ? "Ativo" : "Inativo"}
                    </Badge>
                    {g.rental && g.rental.active && !g.rental.isExpired && (
                      <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                        {g.rental.remaining}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <MessageSquare className="inline h-4 w-4 mr-1" />
              Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {(status?.stats?.messagesProcessed || 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Zap className="inline h-4 w-4 mr-1" />
              Comandos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {(status?.stats?.commandsProcessed || 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Activity className="inline h-4 w-4 mr-1" />
              Reconexoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {(status?.stats?.connections || 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
