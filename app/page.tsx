"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setToken, getApiBase } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Shield, Loader2, Terminal } from "lucide-react"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const base = getApiBase()
      const res = await fetch(`${base}/api/bot/status`, {
        headers: { Authorization: `Bearer ${password}` },
      })

      if (res.ok) {
        setToken(password)
        router.push("/dashboard")
      } else {
        setError("Senha incorreta")
      }
    } catch {
      setError("Erro ao conectar com a API do bot. Verifique se o bot esta rodando.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center gap-4 pb-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">DEMI BOT</h1>
            <p className="text-sm text-muted-foreground mt-1">Painel de Controle</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Senha do Painel
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <Terminal className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                "Acessar Painel"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              API: {getApiBase()}
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
