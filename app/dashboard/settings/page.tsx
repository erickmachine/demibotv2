"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { clearToken } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Settings, Server, Key, LogOut, Copy, ExternalLink } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [apiUrl, setApiUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("demibot_api_url") || "http://129.121.38.161:5001"
    }
    return "http://129.121.38.161:5001"
  })

  function handleSaveApiUrl() {
    if (typeof window !== "undefined") {
      localStorage.setItem("demibot_api_url", apiUrl)
      toast.success("URL da API atualizada")
    }
  }

  function handleLogout() {
    clearToken()
    router.push("/")
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copiado!")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuracoes do painel de controle
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Server className="h-4 w-4" />
            Conexao com a API
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">URL da API do Bot</label>
            <div className="flex gap-2">
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="bg-input border-border flex-1"
                placeholder="http://129.121.38.161:5001"
              />
              <Button onClick={handleSaveApiUrl}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Endereco onde o bot esta rodando (porta 5001 por padrao)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Key className="h-4 w-4" />
            Informacoes do Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Dono</p>
              <p className="text-sm font-mono text-foreground">+55 92 99965-2961</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard("5592999652961")}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Copiar numero</span>
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">IP da VPS</p>
              <p className="text-sm font-mono text-foreground">129.121.38.161</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard("129.121.38.161")}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Copiar IP</span>
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Painel</p>
              <p className="text-sm font-mono text-foreground">http://129.121.38.161:3000</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open("http://129.121.38.161:3000", "_blank")}
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Abrir painel</span>
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">API</p>
              <p className="text-sm font-mono text-foreground">http://129.121.38.161:5001</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard("http://129.121.38.161:5001")}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Copiar URL da API</span>
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Senha Padrao</p>
              <p className="text-sm font-mono text-foreground">demibot2024</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard("demibot2024")}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Copiar senha</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Settings className="h-4 w-4" />
            Prefixos Suportados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {["#", "/", "!", "."].map((p) => (
              <div
                key={p}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary font-mono font-bold"
              >
                {p}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O bot aceita comandos com qualquer um desses prefixos
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardContent className="pt-6">
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair do Painel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
