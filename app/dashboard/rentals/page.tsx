"use client"

import { useEffect, useState } from "react"
import { apiFetch, type GroupInfo, type GroupRental } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Clock, Plus, XCircle, Users, CheckCircle } from "lucide-react"

function ActivateRentalDialog({
  group,
  onSuccess,
}: {
  group: GroupInfo
  onSuccess: () => void
}) {
  const [duration, setDuration] = useState("")
  const [customDuration, setCustomDuration] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleActivate() {
    const dur = duration === "custom" ? customDuration : duration
    if (!dur) return
    setLoading(true)
    try {
      await apiFetch(`/api/groups/${encodeURIComponent(group.id)}/rental`, {
        method: "POST",
        body: JSON.stringify({ duration: dur }),
      })
      toast.success(`Aluguel ativado: ${dur}`)
      onSuccess()
    } catch {
      toast.error("Erro ao ativar aluguel")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="max-w-sm bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">Ativar Aluguel</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{group.name}</p>
      <div className="flex flex-col gap-3 mt-2">
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="bg-input border-border">
            <SelectValue placeholder="Selecionar duracao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30min">30 minutos</SelectItem>
            <SelectItem value="1h">1 hora</SelectItem>
            <SelectItem value="12h">12 horas</SelectItem>
            <SelectItem value="1d">1 dia</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="15d">15 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="90d">90 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {duration === "custom" && (
          <Input
            placeholder="Ex: 45d, 2h, 120min"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            className="bg-input border-border"
          />
        )}

        <Button
          onClick={handleActivate}
          disabled={loading || (!duration || (duration === "custom" && !customDuration))}
          className="w-full"
        >
          {loading ? "Ativando..." : "Ativar Aluguel"}
        </Button>
      </div>
    </DialogContent>
  )
}

export default function RentalsPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const g = await apiFetch<GroupInfo[]>("/api/groups")
      setGroups(g)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function deactivateRental(groupId: string) {
    try {
      await apiFetch(`/api/groups/${encodeURIComponent(groupId)}/rental`, {
        method: "DELETE",
      })
      toast.success("Aluguel desativado")
      load()
    } catch {
      toast.error("Erro ao desativar")
    }
  }

  const active = groups.filter(
    (g) => g.rental?.active && !g.rental?.isExpired
  )
  const inactive = groups.filter(
    (g) => !g.rental?.active || g.rental?.isExpired
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Alugueis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie a mensalidade dos grupos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{active.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inativos</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{inactive.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{groups.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Rentals */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Grupos Ativos</h2>
        {active.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum grupo com aluguel ativo</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((g) => (
              <Card key={g.id} className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {g.members}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {g.rental?.remaining}
                      </span>
                      <span>Plano: {g.rental?.duration}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deactivateRental(g.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Desativar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Groups */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Grupos Inativos</h2>
        {inactive.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Todos os grupos estao ativos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {inactive.map((g) => (
              <Card key={g.id} className="border-border/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                    <span className="text-xs text-muted-foreground">{g.members} membros</span>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-1" />
                        Ativar
                      </Button>
                    </DialogTrigger>
                    <ActivateRentalDialog group={g} onSuccess={load} />
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
