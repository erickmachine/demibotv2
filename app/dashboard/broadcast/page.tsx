"use client"

import { useEffect, useState } from "react"
import { apiFetch, type GroupInfo } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Send, Users, Radio } from "lucide-react"

export default function BroadcastPage() {
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [target, setTarget] = useState("all")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    apiFetch<GroupInfo[]>("/api/groups")
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    try {
      if (target === "all") {
        const res = await apiFetch<{ groupsSent: number }>("/api/broadcast", {
          method: "POST",
          body: JSON.stringify({ message }),
        })
        toast.success(`Mensagem enviada para ${res.groupsSent} grupos`)
      } else if (selectedGroup) {
        await apiFetch("/api/send", {
          method: "POST",
          body: JSON.stringify({ groupId: selectedGroup, message }),
        })
        toast.success("Mensagem enviada")
      }
      setMessage("")
    } catch {
      toast.error("Erro ao enviar mensagem")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const activeGroups = groups.filter(
    (g) => g.rental?.active && !g.rental?.isExpired
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie mensagens para grupos
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Radio className="h-4 w-4" />
            Enviar Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Destino</label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Todos os grupos ativos ({activeGroups.length})
                </SelectItem>
                <SelectItem value="single">Grupo especifico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === "single" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Grupo</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecionar grupo" />
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
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Mensagem</label>
            <Textarea
              placeholder="Digite a mensagem para enviar..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="bg-input border-border resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} caracteres - Suporta formatacao WhatsApp (*negrito*, _italico_)
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || (target === "single" && !selectedGroup)}
            className="w-full sm:w-auto sm:self-end"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            Grupos Ativos ({activeGroups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum grupo ativo
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeGroups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                >
                  <span className="text-sm text-foreground truncate">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.members}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
