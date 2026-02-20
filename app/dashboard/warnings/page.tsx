"use client"

import { useEffect, useState } from "react"
import { apiFetch, type GroupInfo } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Users } from "lucide-react"

interface Warning {
  reason: string
  date: number
  id: string
}

export default function WarningsPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [selectedGroup, setSelectedGroup] = useState("")
  const [warnings, setWarnings] = useState<Record<string, Warning[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingWarnings, setLoadingWarnings] = useState(false)

  useEffect(() => {
    apiFetch<GroupInfo[]>("/api/groups")
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    setLoadingWarnings(true)
    apiFetch<Record<string, Warning[]>>(
      `/api/groups/${encodeURIComponent(selectedGroup)}/warnings`
    )
      .then(setWarnings)
      .catch(() => {})
      .finally(() => setLoadingWarnings(false))
  }, [selectedGroup])

  const warningEntries = Object.entries(warnings).filter(
    ([, warns]) => warns.length > 0
  )
  const totalWarnings = warningEntries.reduce(
    (sum, [, warns]) => sum + warns.length,
    0
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Advertencias</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize as advertencias dos membros
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Selecionar Grupo</label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="bg-input border-border max-w-md">
            <SelectValue placeholder="Escolha um grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.members})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedGroup ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Selecione um grupo para ver as advertencias
            </p>
          </CardContent>
        </Card>
      ) : loadingWarnings ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : warningEntries.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma advertencia neste grupo
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{warningEntries.length} membro(s) advertido(s)</span>
            <span>{totalWarnings} advertencia(s) total</span>
          </div>

          <div className="flex flex-col gap-3">
            {warningEntries.map(([userId, warns]) => (
              <Card key={userId} className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-sm font-mono text-foreground">
                      {userId.replace(/@.+/, "")}
                    </span>
                    <Badge
                      variant={warns.length >= 3 ? "destructive" : "secondary"}
                      className={
                        warns.length >= 3
                          ? ""
                          : "bg-secondary text-secondary-foreground"
                      }
                    >
                      {warns.length} advertencia(s)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1.5">
                    {warns.map((w, i) => (
                      <div
                        key={w.id || i}
                        className="flex items-center justify-between rounded bg-secondary/50 px-3 py-1.5"
                      >
                        <span className="text-xs text-foreground">{w.reason}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(w.date).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
