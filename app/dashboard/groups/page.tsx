"use client"

import { useEffect, useState } from "react"
import { apiFetch, type GroupInfo } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Users,
  Search,
  Settings,
  Clock,
  Shield,
  Link as LinkIcon,
  MessageSquare,
  Ban,
  Zap,
} from "lucide-react"

function GroupConfigDialog({ group }: { group: GroupInfo }) {
  const [config, setConfig] = useState(group.config)
  const [saving, setSaving] = useState(false)

  async function toggleConfig(key: string, value: boolean) {
    setSaving(true)
    try {
      await apiFetch(`/api/groups/${encodeURIComponent(group.id)}/config`, {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      })
      setConfig((prev) => ({ ...prev, [key]: value }))
      toast.success(`${key} ${value ? "ativado" : "desativado"}`)
    } catch {
      toast.error("Erro ao salvar configuracao")
    } finally {
      setSaving(false)
    }
  }

  const toggles = [
    { key: "antilink", label: "Anti-link", icon: LinkIcon },
    { key: "antifake", label: "Anti-fake", icon: Ban },
    { key: "antipalavra", label: "Anti-palavrao", icon: MessageSquare },
    { key: "antiflood", label: "Anti-flood", icon: Zap },
    { key: "autosticker", label: "Auto-sticker", icon: Settings },
    { key: "autodl", label: "Auto-download", icon: Settings },
    { key: "welcome", label: "Boas-vindas", icon: Users },
    { key: "goodbye", label: "Mensagem saida", icon: Users },
    { key: "soadm", label: "So admins", icon: Shield },
    { key: "x9viewonce", label: "X9 view-once", icon: Shield },
    { key: "multiprefix", label: "Multi-prefixo", icon: Settings },
  ]

  return (
    <DialogContent className="max-w-lg bg-card border-border max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          {group.name}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Membros</span>
          <span className="text-sm font-medium text-foreground">{group.members}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Status Aluguel</span>
          <Badge
            variant={group.rental?.active && !group.rental?.isExpired ? "default" : "secondary"}
            className={
              group.rental?.active && !group.rental?.isExpired
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-secondary text-muted-foreground"
            }
          >
            {group.rental?.active && !group.rental?.isExpired
              ? `Ativo - ${group.rental.remaining}`
              : "Inativo"}
          </Badge>
        </div>

        <h3 className="text-sm font-medium text-foreground mt-2">Protecoes</h3>
        {toggles.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">{t.label}</span>
            </div>
            <Switch
              checked={config[t.key as keyof typeof config] as boolean}
              onCheckedChange={(v) => toggleConfig(t.key, v)}
              disabled={saving}
            />
          </div>
        ))}

        <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5">
          <span className="text-sm text-foreground">Max advertencias</span>
          <span className="text-sm font-mono text-primary">{config.maxWarnings}</span>
        </div>
      </div>
    </DialogContent>
  )
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    apiFetch<GroupInfo[]>("/api/groups")
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Grupos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os grupos conectados ao bot
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar grupo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filtered.length} grupo(s)</span>
        <span>
          {filtered.filter((g) => g.rental?.active && !g.rental?.isExpired).length} ativo(s)
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "Nenhum grupo encontrado" : "Nenhum grupo conectado"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((g) => (
            <Card key={g.id} className="border-border/50">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    <Badge
                      variant={g.rental?.active && !g.rental?.isExpired ? "default" : "secondary"}
                      className={
                        g.rental?.active && !g.rental?.isExpired
                          ? "bg-primary/10 text-primary border-primary/20 text-xs"
                          : "bg-secondary text-muted-foreground text-xs"
                      }
                    >
                      {g.rental?.active && !g.rental?.isExpired ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {g.members}
                    </span>
                    {g.rental?.active && !g.rental?.isExpired && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {g.rental.remaining}
                      </span>
                    )}
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                      <Settings className="h-4 w-4" />
                      <span className="sr-only">Configurar grupo</span>
                    </Button>
                  </DialogTrigger>
                  <GroupConfigDialog group={g} />
                </Dialog>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
