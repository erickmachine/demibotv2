# DEMI BOT - WhatsApp Group Bot

Bot completo para gerenciamento de grupos WhatsApp com painel administrativo web.

## Requisitos

- **Node.js** 18+
- **pnpm** (ou npm/yarn)
- **VPS** com acesso a porta 3000 (painel) e 5001 (API)

## Instalacao na VPS

```bash
# 1. Clonar o repositorio
git clone https://github.com/seu-usuario/demi-bot.git
cd demi-bot

# 2. Instalar dependencias
pnpm install

# 3. Buildar o painel (Next.js)
pnpm build

# 4. Instalar PM2 globalmente (caso nao tenha)
npm install -g pm2
```

### Primeira vez (conectar o QR Code)

Na primeira vez voce precisa rodar o bot manualmente para escanear o QR Code:

```bash
# Roda o bot no terminal para ver o QR Code
pnpm bot
```

Escaneie o QR Code com o WhatsApp. Depois que conectar e aparecer `[DEMI BOT] Conectado com sucesso!`, pare com `Ctrl+C`.

### Rodando tudo com PM2 (forma definitiva)

Depois de conectar o QR Code, use PM2 para rodar o bot e o painel juntos:

```bash
# Inicia bot + painel juntos
pm2 start ecosystem.config.cjs

# Ver status dos processos
pm2 status

# Ver logs em tempo real
pm2 logs

# Ver logs so do bot
pm2 logs demi-bot

# Ver logs so do painel
pm2 logs demi-painel

# Parar tudo
pm2 stop all

# Reiniciar tudo
pm2 restart all

# Fazer PM2 iniciar automaticamente quando a VPS reiniciar
pm2 startup
pm2 save
```

### Comandos uteis do PM2

```bash
# Reiniciar apenas o bot (quando atualizar o codigo)
pm2 restart demi-bot

# Reiniciar apenas o painel
pm2 restart demi-painel

# Monitorar CPU/RAM em tempo real
pm2 monit

# Deletar tudo e comecar do zero
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Atualizando o codigo

```bash
git pull
pnpm install
pnpm build
pm2 restart all
```

### Sessao corrompida (Bad MAC errors repetidos)

Se o bot nao conseguir conectar ou ficar com erros de criptografia:

```bash
pm2 stop demi-bot
rm -rf session/
pm2 start demi-bot
# OU rode manualmente para ver o QR:
pm2 stop demi-bot
pnpm bot
# Escaneie o QR, depois Ctrl+C e pm2 start demi-bot
```

## Acessos

| Servico | URL |
|---------|-----|
| Painel  | `http://129.121.38.161:3000` |
| API     | `http://129.121.38.161:5001` |

**Senha padrao do painel:** `demibot2024`

**Numero do dono:** `+55 92 99965-2961`

## Estrutura

```
demi-bot/
  index.js              # Bot WhatsApp (Baileys) + API Express
  app/                  # Painel Next.js
    page.tsx            # Tela de login
    dashboard/
      page.tsx          # Dashboard principal
      groups/page.tsx   # Gerenciar grupos
      rentals/page.tsx  # Gerenciar alugueis
      blacklist/page.tsx# Lista negra
      broadcast/page.tsx# Enviar mensagens
      warnings/page.tsx # Advertencias
      settings/page.tsx # Configuracoes
  database/             # Banco de dados JSON (criado automaticamente)
  session/              # Sessao do WhatsApp (criado automaticamente)
```

## Sistema de Aluguel (Mensalidade)

O bot so funciona nos grupos que possuem aluguel ativo. O dono controla a ativacao:

```
#ativarbot 30d     # Ativa por 30 dias
#ativarbot 24h     # Ativa por 24 horas
#ativarbot 30min   # Ativa por 30 minutos
#desativarbot      # Desativa imediatamente
#verificar_aluguel # Verifica o status
```

O bot notifica automaticamente:
- 3 dias antes da expiracao
- 1 dia antes da expiracao
- 1 hora antes da expiracao
- Quando expira

Tambem e possivel ativar/desativar pelo painel web na aba "Alugueis".

## Prefixos Aceitos

O bot aceita os seguintes prefixos: `#` `/` `!` `.`

## Comandos Completos

### Menus

| Comando | Descricao |
|---------|-----------|
| `#menu` | Menu principal |
| `#menu adm` | Menu de administracao |
| `#menu gold` | Menu de economia |
| `#menu download` | Menu de downloads |
| `#menu figurinhas` | Menu de stickers |
| `#menu brincadeiras` | Menu de jogos |
| `#menu efeitos` | Menu de efeitos |
| `#menu info` | Menu de informacoes |
| `#menu dono` | Menu do dono (restrito) |
| `#menu grupo` | Menu do grupo |

### Comandos do Dono

| Comando | Descricao |
|---------|-----------|
| `#ativarbot <tempo>` | Ativar bot no grupo |
| `#desativarbot` | Desativar bot |
| `#verificar_aluguel` | Status do aluguel |
| `#bc <mensagem>` | Broadcast para todos os grupos |
| `#join <link>` | Entrar em grupo |
| `#sairgp` | Sair do grupo |
| `#grupos` | Listar todos os grupos |

### Administracao

| Comando | Descricao |
|---------|-----------|
| `#ban @usuario` | Banir membro |
| `#add <numero>` | Adicionar membro |
| `#advertir @usuario <motivo>` | Advertir membro |
| `#checkwarnings @usuario` | Ver advertencias |
| `#removewarning @usuario` | Remover advertencia |
| `#clearwarnings @usuario` | Limpar advertencias |
| `#advertidos` | Listar advertidos |
| `#promover @usuario` | Promover a admin |
| `#rebaixar @usuario` | Rebaixar admin |
| `#mute @usuario` | Silenciar |
| `#desmute @usuario` | Desmutar |
| `#fechargp` | Fechar grupo |
| `#abrirgp` | Abrir grupo |
| `#nomegp <nome>` | Alterar nome |
| `#descgp <desc>` | Alterar descricao |
| `#linkgp` | Link do grupo |
| `#tagall` | Marcar todos |
| `#admins` | Listar admins |
| `#banghost` | Banir fantasmas |
| `#banfakes` | Banir numeros fake |
| `#inativos <dias>` | Listar inativos |
| `#aceitar` | Aceitar solicitacoes |

### Protecoes (toggle on/off)

| Comando | Descricao |
|---------|-----------|
| `#antilink` | Anti-link |
| `#antifake` | Anti-fake (numeros estrangeiros) |
| `#antipalavra` | Anti-palavrao |
| `#antiflood` | Anti-flood |
| `#soadm` | Modo so admins |
| `#autosticker` | Auto sticker |
| `#autodl` | Auto download |
| `#x9viewonce` | X9 visualizacao unica |
| `#bemvindo` | Boas-vindas on/off |
| `#multiprefix` | Multi-prefixo on/off |
| `#status` | Ver status de todas protecoes |

### Palavroes

| Comando | Descricao |
|---------|-----------|
| `#addpalavra <palavra>` | Adicionar palavrao |
| `#delpalavra <palavra>` | Remover palavrao |
| `#listapalavrao` | Listar palavroes |

### Lista Negra

| Comando | Descricao |
|---------|-----------|
| `#listanegra` | Ver lista negra |
| `#listanegra <numero>` | Adicionar a lista |
| `#tirardalista <numero>` | Remover da lista |

### Cargos

| Comando | Descricao |
|---------|-----------|
| `#cargo @usuario <cargo>` | Definir cargo |
| `#cargos` | Ver cargos do grupo |

Cargos disponiveis: `administrador`, `moderador`, `auxiliar`, `membro`

Hierarquia: Dono > Administrador > Moderador > Auxiliar > Membro

### Notas

| Comando | Descricao |
|---------|-----------|
| `#anotar <texto>` | Salvar nota |
| `#anotacao` | Ver notas |
| `#tirar_nota <indice>` | Remover nota |

### Mensagens Agendadas

| Comando | Descricao |
|---------|-----------|
| `#mensagem-automatica HH:MM <texto>` | Agendar mensagem |
| `#listar-mensagens-automaticas` | Ver agendadas |
| `#limpar-agendadas` | Limpar todas |

### Boas-vindas / Saida

| Comando | Descricao |
|---------|-----------|
| `#legendabv <texto>` | Definir mensagem de boas-vindas |
| `#legendasaiu <texto>` | Definir mensagem de saida |

### Gold / Economia

| Comando | Descricao |
|---------|-----------|
| `#gold` | Ver saldo |
| `#rankgold` | Ranking de gold |
| `#daily` | Recompensa diaria |
| `#doargold @usuario <valor>` | Doar gold |
| `#roubargold @usuario` | Tentar roubar |
| `#minerar_gold` | Minerar gold |
| `#cassino <valor>` | Apostar no cassino |
| `#roletadasorte <valor>` | Roleta da sorte |
| `#addgold @usuario <valor>` | Adicionar gold (ADM) |
| `#zerar_gold @usuario` | Zerar gold (ADM) |
| `#sorteiogold` | Sorteio de gold (ADM) |

### Atividade / Rankings

| Comando | Descricao |
|---------|-----------|
| `#rankativos` | Ranking de ativos |
| `#rankativosg` | Ranking global |
| `#checkativo @usuario` | Checar atividade |

### Brincadeiras

| Comando | Descricao |
|---------|-----------|
| `#ppt <escolha>` | Pedra Papel Tesoura |
| `#roleta` | Roleta russa |
| `#sorteio` | Sortear membro |
| `#chance <texto>` | Chance de algo |
| `#rankgay` | Ranking gay |
| `#rankgado` | Ranking gado |
| `#rankcorno` | Ranking corno |
| `#rankgostoso` | Ranking gostoso |
| `#gadometro` | Gadometro |
| `#corno` | Cornometro |
| `#casal` | Sortear casal |
| `#pergunta` | Pergunta aleatoria |
| `#eujaeununca` | Eu ja eu nunca |
| `#duelo @usuario` | Desafiar para duelo |
| `#sn <pergunta>` | Sim ou Nao |

### Figurinhas

| Comando | Descricao |
|---------|-----------|
| `#sticker` / `#s` | Criar figurinha |
| `#toimg` | Figurinha para imagem |
| `#ttp <texto>` | Texto para figurinha |
| `#take <pack\|autor>` | Alterar pack |

### Efeitos de Imagem

| Comando | Descricao |
|---------|-----------|
| `#blur` | Efeito blur |
| `#greyscale` | Preto e branco |
| `#sepia` | Efeito sepia |
| `#invert` | Inverter cores |
| `#circulo` | Recorte circular |

### Downloads

| Comando | Descricao |
|---------|-----------|
| `#play <musica>` | Baixar audio |
| `#ytsearch <texto>` | Buscar no YouTube |
| `#pinterest <texto>` | Buscar no Pinterest |
| `#letra <musica>` | Buscar letra |

### Utilidades

| Comando | Descricao |
|---------|-----------|
| `#traduzir <idioma> <texto>` | Traduzir texto |
| `#clima <cidade>` | Clima |
| `#calculadora <expressao>` | Calculadora |
| `#signo <nome>` | Horoscopo |
| `#moedas` | Cotacoes |
| `#encurtalink <url>` | Encurtar link |
| `#wame` | Gerar wa.me |
| `#perfil` | Ver perfil |
| `#eco <texto>` | Repetir texto |
| `#afk <motivo>` | Modo ausente |
| `#ativo` | Sair do modo ausente |
| `#deletar` | Apagar mensagem |

### Informacoes

| Comando | Descricao |
|---------|-----------|
| `#ping` | Verificar bot |
| `#info` | Info do bot |
| `#dono` | Contato do dono |
| `#ajuda` | Como usar |
| `#grupoinfo` | Info do grupo |
| `#prefixos` | Ver prefixos |

## Rodando com PM2 (Recomendado para VPS)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o bot
pm2 start index.js --name demi-bot

# Iniciar o painel
pm2 start npm --name demi-painel -- start

# Salvar processos para reiniciar automaticamente
pm2 save
pm2 startup
```

## Comandos PM2 Uteis

```bash
pm2 list              # Listar processos
pm2 logs demi-bot     # Ver logs do bot
pm2 restart demi-bot  # Reiniciar bot
pm2 stop demi-bot     # Parar bot
```

## Configuracao

Edite as constantes no inicio do `index.js`:

```javascript
const CONFIG = {
  ownerNumber: '5592999652961',    // Numero do dono
  botName: 'DEMI BOT',            // Nome do bot
  prefix: ['#', '/', '!', '.'],   // Prefixos aceitos
  apiPort: 5001,                   // Porta da API
  panelPassword: 'demibot2024',    // Senha do painel
}
```

## Seguranca

- Altere a senha padrao do painel em `CONFIG.panelPassword`
- A API usa autenticacao via Bearer Token
- O bot so responde comandos em grupos com aluguel ativo
- Comandos do dono sao restritos ao numero configurado

## Licenca

Uso pessoal. Desenvolvido para gerenciamento de grupos WhatsApp.
