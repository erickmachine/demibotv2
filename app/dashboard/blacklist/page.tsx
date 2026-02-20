"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Ban, Plus, Trash2, Search } from "lucide-react"

interface BlacklistEntry {
  reason: string
  addedBy: string
  date: number
}

export default function BlacklistPage() {
  const [entries, setEntries] = useState<Record<string, BlacklistEntry>>({})
  const [loading, setLoading] = useState(true)
  const [number, setNumber] = useState("")
  const [reason, setReason] = useState("")
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")

  async function load() {
    try {
      const data = await apiFetch<Record<string, BlacklistEntry>>("/api/blacklist")
      setEntries(data)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!number) return
    setAdding(true)
    try {
      await apiFetch("/api/blacklist", {
        method: "POST",
        body: JSON.stringify({ number: number.replace(/[^0-9]/g, ""), reason }),
      })
      toast.success("Adicionado a lista negra")
      setNumber("")
      setReason("")
      load()
    } catch {
      toast.error("Erro ao adicionar")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(num: string) {
    try {
      await apiFetch(`/api/blacklist/${num}`, { method: "DELETE" })
      toast.success("Removido da lista negra")
      load()
    } catch {
      toast.error("Erro ao remover")
    }
  }

  const entryList = Object.entries(entries).filter(([num]) =>
    num.includes(search)
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Lista Negra</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Numeros banidos globalmente de todos os grupos
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Numero (ex: 5511999999999)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="bg-input border-border flex-1"
            />
            <Input
              placeholder="Motivo (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-input border-border flex-1"
            />
            <Button type="submit" disabled={adding || !number}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar numero..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      <p className="text-sm text-muted-foreground">{entryList.length} numero(s) na lista negra</p>

      {entryList.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Ban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Lista negra vazia</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {entryList.map(([num, data]) => (
            <Card key={num} className="border-border/50">
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground">{num}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{data.reason || "Sem motivo"}</span>
                    <span>-</span>
                    <span>Por: {data.addedBy || "Sistema"}</span>
                    <span>-</span>
                    <span>{new Date(data.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(num)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remover da lista negra</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
