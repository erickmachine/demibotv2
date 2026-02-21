/**
 * ============================================
 *  DEMI BOT - WhatsApp Group Bot Completo
 *  Dono: +559299652961
 *  Framework: @whiskeysockets/baileys
 *  Painel: Next.js em http://129.121.38.161:3000
 * ============================================
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const baileys = require('@whiskeysockets/baileys')
const makeWASocket = baileys.default || baileys
const {
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  getContentType,
  jidNormalizedUser,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  delay
} = baileys

const pino = require('pino')
const { Boom } = require('@hapi/boom')
const axios = require('axios')

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'

const express = require('express')
const cors = require('cors')
const sharp = require('sharp')

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Silenciar erros de decrypt do Baileys (Bad MAC / session errors)
const _origConsoleError = console.error
console.error = (...args) => {
  const msg = args[0]?.toString?.() || ''
  if (
    msg.includes('Bad MAC') ||
    msg.includes('Failed to decrypt') ||
    msg.includes('Closing open session') ||
    msg.includes('Closing session') ||
    msg.includes('Session error')
  ) return
  _origConsoleError.apply(console, args)
}

// ============================================
// CONFIGURACAO GLOBAL
// ============================================
const CONFIG = {
  ownerNumber: '559299652961',
  ownerNumbers: ['559299652961', '559299652961'],
  ownerJid: '559299652961@s.whatsapp.net',
  botName: 'DEMI BOT',
  prefix: ['#', '/', '!', '.'],
  apiPort: 5001,
  panelPassword: 'demibot2024',
  dbPath: path.join(__dirname, 'database'),
  mediaPath: path.join(__dirname, 'media'),
  sessionPath: path.join(__dirname, 'session'),
}

// Garantir diretorios existam
;[CONFIG.dbPath, CONFIG.mediaPath, CONFIG.sessionPath].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

// ============================================
// BANCO DE DADOS (JSON)
// ============================================
class Database {
  constructor(name) {
    this.path = path.join(CONFIG.dbPath, `${name}.json`)
    this.data = this.load()
  }
  load() {
    try {
      if (fs.existsSync(this.path)) return JSON.parse(fs.readFileSync(this.path, 'utf8'))
    } catch (e) { console.error(`Erro ao carregar ${this.path}:`, e.message) }
    return {}
  }
  save() {
    try { fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2)) }
    catch (e) { console.error(`Erro ao salvar ${this.path}:`, e.message) }
  }
  get(key, defaultVal = null) { return this.data[key] ?? defaultVal }
  set(key, value) { this.data[key] = value; this.save() }
  delete(key) { delete this.data[key]; this.save() }
  getAll() { return this.data }
}

// Inicializar bancos
const db = {
  groups: new Database('groups'),
  users: new Database('users'),
  blacklist: new Database('blacklist'),
  warnings: new Database('warnings'),
  rental: new Database('rental'),
  gold: new Database('gold'),
  activity: new Database('activity'),
  notes: new Database('notes'),
  scheduled: new Database('scheduled'),
  roles: new Database('roles'),
  afk: new Database('afk'),
  birthday: new Database('birthday'),
  badwords: new Database('badwords'),
  stickerCmd: new Database('stickerCmd'),
  stats: new Database('stats'),
}

// ============================================
// STORE EM MEMORIA
// ============================================
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

// ============================================
// FUNCOES UTILITARIAS
// ============================================
const sleep = ms => new Promise(r => setTimeout(r, ms))
const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)]
const isUrl = str => /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/.test(str)
const formatPhone = jid => jid?.replace(/@.+/, '') || ''
const formatJid = number => `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`
const isGroup = jid => jid?.endsWith('@g.us')
const isOwnerNumber = (number) => {
  const clean = number.replace(/[^0-9]/g, '')
  return CONFIG.ownerNumbers.some(n => clean === n || clean.endsWith(n) || n.endsWith(clean))
}
const formatDate = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function parseTime(timeStr) {
  const match = timeStr.match(/^(\d+)(min|h|d|dias|horas|minutos|m|hours|days)$/i)
  if (!match) return null
  const [, num, unit] = match
  const val = parseInt(num)
  switch (unit.toLowerCase()) {
    case 'min': case 'm': case 'minutos': return val * 60 * 1000
    case 'h': case 'horas': case 'hours': return val * 60 * 60 * 1000
    case 'd': case 'dias': case 'days': return val * 24 * 60 * 60 * 1000
    default: return null
  }
}

function timeRemaining(expireDate) {
  const diff = new Date(expireDate) - Date.now()
  if (diff <= 0) return 'Expirado'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h ${mins}min`
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

// ============================================
// SISTEMA DE ALUGUEL / RENTAL
// ============================================
function activateRental(groupId, duration, activatedBy) {
  const ms = parseTime(duration)
  if (!ms) return null
  const now = Date.now()
  const expireAt = now + ms
  db.rental.set(groupId, {
    activatedAt: now,
    expireAt,
    duration,
    activatedBy,
    notified3d: false,
    notified1d: false,
    notified1h: false,
    active: true
  })
  return expireAt
}

function checkRental(groupId) {
  const rental = db.rental.get(groupId)
  if (!rental) return { active: false, reason: 'not_activated' }
  if (!rental.active) return { active: false, reason: 'deactivated' }
  if (Date.now() > rental.expireAt) {
    rental.active = false
    db.rental.set(groupId, rental)
    return { active: false, reason: 'expired' }
  }
  return { active: true, rental }
}

function getRentalInfo(groupId) {
  const rental = db.rental.get(groupId)
  if (!rental) return null
  return {
    ...rental,
    remaining: timeRemaining(rental.expireAt),
    isExpired: Date.now() > rental.expireAt
  }
}

// ============================================
// SISTEMA DE CARGOS / PERMISSOES
// ============================================
const ROLES = {
  OWNER: 'owner',
  ADMIN: 'administrador',
  MOD: 'moderador',
  AUX: 'auxiliar',
  MEMBER: 'membro'
}

function getUserRole(groupId, userId) {
  const roles = db.roles.get(groupId, {})
  if (isOwnerNumber(formatPhone(userId))) return ROLES.OWNER
  return roles[userId] || ROLES.MEMBER
}

function setUserRole(groupId, userId, role) {
  const roles = db.roles.get(groupId, {})
  roles[userId] = role
  db.roles.set(groupId, roles)
}

function removeUserRole(groupId, userId) {
  const roles = db.roles.get(groupId, {})
  delete roles[userId]
  db.roles.set(groupId, roles)
}

function hasPermission(groupId, userId, minRole) {
  const hierarchy = [ROLES.MEMBER, ROLES.AUX, ROLES.MOD, ROLES.ADMIN, ROLES.OWNER]
  const userRole = getUserRole(groupId, userId)
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(minRole)
}

// ============================================
// SISTEMA DE ADVERTENCIAS
// ============================================
function addWarning(groupId, userId, reason = '') {
  const key = `${groupId}_${userId}`
  const warns = db.warnings.get(key, [])
  warns.push({ reason, date: Date.now(), id: crypto.randomBytes(4).toString('hex') })
  db.warnings.set(key, warns)
  return warns.length
}

function getWarnings(groupId, userId) {
  return db.warnings.get(`${groupId}_${userId}`, [])
}

function removeWarning(groupId, userId, index = -1) {
  const key = `${groupId}_${userId}`
  const warns = db.warnings.get(key, [])
  if (index === -1) warns.pop()
  else warns.splice(index, 1)
  db.warnings.set(key, warns)
  return warns.length
}

function clearWarnings(groupId, userId) {
  db.warnings.set(`${groupId}_${userId}`, [])
}

// ============================================
// SISTEMA DE GOLD / ECONOMIA
// ============================================
function getGold(groupId, userId) {
  const gold = db.gold.get(groupId, {})
  return gold[userId] || 0
}

function setGold(groupId, userId, amount) {
  const gold = db.gold.get(groupId, {})
  gold[userId] = Math.max(0, amount)
  db.gold.set(groupId, gold)
}

function addGold(groupId, userId, amount) {
  setGold(groupId, userId, getGold(groupId, userId) + amount)
}

function removeGold(groupId, userId, amount) {
  const current = getGold(groupId, userId)
  if (current < amount) return false
  setGold(groupId, userId, current - amount)
  return true
}

function getGoldRanking(groupId, limit = 10) {
  const gold = db.gold.get(groupId, {})
  return Object.entries(gold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([user, amount], i) => ({ pos: i + 1, user, amount }))
}

// ============================================
// SISTEMA DE ATIVIDADE
// ============================================
function trackActivity(groupId, userId) {
  const key = `${groupId}_${userId}`
  const act = db.activity.get(key, { messages: 0, lastSeen: 0, stickers: 0 })
  act.messages++
  act.lastSeen = Date.now()
  db.activity.set(key, act)
  if (act.messages % 5 === 0) addGold(groupId, userId, 1)
}

function getActivityRanking(groupId, limit = 10) {
  const allData = db.activity.getAll()
  const groupActivities = []
  for (const [key, val] of Object.entries(allData)) {
    if (key.startsWith(groupId + '_')) {
      const userId = key.replace(groupId + '_', '')
      groupActivities.push({ user: userId, ...val })
    }
  }
  return groupActivities
    .sort((a, b) => b.messages - a.messages)
    .slice(0, limit)
    .map((a, i) => ({ pos: i + 1, ...a }))
}

function getInactiveMembers(groupId, participants, daysThreshold = 7) {
  const threshold = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000)
  const inactive = []
  for (const p of participants) {
    const key = `${groupId}_${p.id}`
    const act = db.activity.get(key)
    if (!act || act.lastSeen < threshold) {
      inactive.push({ user: p.id, lastSeen: act?.lastSeen || 0 })
    }
  }
  return inactive
}

// ============================================
// SISTEMA DE LISTA NEGRA
// ============================================
function addToBlacklist(number, reason = '', addedBy = '') {
  db.blacklist.set(number.replace(/[^0-9]/g, ''), { reason, addedBy, date: Date.now() })
}

function removeFromBlacklist(number) {
  db.blacklist.delete(number.replace(/[^0-9]/g, ''))
}

function isBlacklisted(jid) {
  return !!db.blacklist.get(formatPhone(jid))
}

// ============================================
// CONFIGURACAO DE GRUPO
// ============================================
function getGroupConfig(groupId) {
  return db.groups.get(groupId, {
    antilink: false,
    antifake: false,
    antipalavra: false,
    antisticker: false,
    antiimg: false,
    antivideo: false,
    antiaudio: false,
    antidoc: false,
    antiflood: false,
    anticall: false,
    autoban: false,
    autosticker: false,
    autodl: false,
    welcome: true,
    goodbye: true,
    x9viewonce: false,
    x9adm: false,
    soadm: false,
    modoparceria: false,
    limitexto: 0,
    maxWarnings: 3,
    welcomeMsg: '',
    goodbyeMsg: '',
    welcomeBg: '',
    goodbyeBg: '',
    linkWhitelist: ['instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'vm.tiktok.com'],
    prefix: '#',
    multiprefix: true,
    nivel: false,
  })
}

function setGroupConfig(groupId, key, value) {
  const config = getGroupConfig(groupId)
  config[key] = value
  db.groups.set(groupId, config)
}

// ============================================
// SISTEMA DE MENSAGENS AGENDADAS
// ============================================
function addScheduledMessage(groupId, { text, media, hour, minute, days, oneTime, createdBy }) {
  const msgs = db.scheduled.get(groupId, [])
  msgs.push({
    id: crypto.randomBytes(4).toString('hex'),
    text, media, hour, minute,
    days: days || [0, 1, 2, 3, 4, 5, 6],
    oneTime: oneTime || false,
    createdBy,
    createdAt: Date.now(),
    active: true,
    lastSent: 0
  })
  db.scheduled.set(groupId, msgs)
}

function getScheduledMessages(groupId) {
  return db.scheduled.get(groupId, [])
}

function removeScheduledMessage(groupId, msgId) {
  const msgs = db.scheduled.get(groupId, [])
  const filtered = msgs.filter(m => m.id !== msgId)
  db.scheduled.set(groupId, filtered)
}

// ============================================
// PALAVROES / BADWORDS
// ============================================
function addBadword(groupId, word) {
  const words = db.badwords.get(groupId, [])
  if (!words.includes(word.toLowerCase())) {
    words.push(word.toLowerCase())
    db.badwords.set(groupId, words)
  }
}

function removeBadword(groupId, word) {
  const words = db.badwords.get(groupId, [])
  const filtered = words.filter(w => w !== word.toLowerCase())
  db.badwords.set(groupId, filtered)
}

function checkBadwords(groupId, text) {
  const words = db.badwords.get(groupId, [])
  const lower = text.toLowerCase()
  return words.find(w => lower.includes(w))
}

// ============================================
// NOTAS / ANOTACOES
// ============================================
function addNote(groupId, text, addedBy) {
  const notes = db.notes.get(groupId, [])
  notes.push({ text, addedBy, date: Date.now(), id: crypto.randomBytes(4).toString('hex') })
  db.notes.set(groupId, notes)
}

function getNotes(groupId) { return db.notes.get(groupId, []) }

function removeNote(groupId, index) {
  const notes = db.notes.get(groupId, [])
  notes.splice(index, 1)
  db.notes.set(groupId, notes)
}

// ============================================
// ESTATISTICAS
// ============================================
function incrementStat(key) {
  const stats = db.stats.get('global', {})
  stats[key] = (stats[key] || 0) + 1
  db.stats.set('global', stats)
}

// ============================================
// MENUS DO BOT
// ============================================
function generateMainMenu(groupId, prefix) {
  const rental = getRentalInfo(groupId)
  const rentalStr = rental ? `Plano: ${rental.duration} | Restante: ${rental.remaining}` : 'Sem plano ativo'
  return `
*${CONFIG.botName}*
_Gerenciador de Grupos WhatsApp_

${rentalStr}

*MENUS DISPONIVEIS*

${prefix}menu figurinhas - Figurinhas e stickers
${prefix}menu brincadeiras - Jogos e diversao
${prefix}menu efeitos - Efeitos de imagem/audio
${prefix}menu adm - Comandos administrativos
${prefix}menu gold - Sistema de economia
${prefix}menu download - Downloads de midia
${prefix}menu info - Informacoes
${prefix}menu grupo - Gestao do grupo
${prefix}menu jogos - Jogos interativos
${prefix}menu dono - Comandos do dono

*ATALHOS RAPIDOS*

${prefix}ping - Verificar bot
${prefix}status - Status das funcoes
${prefix}ajuda - Como usar o bot
`.trim()
}

function generateAdminMenu(prefix) {
  return `
*MENU ADMINISTRACAO*

*Moderacao:*
${prefix}ban @usuario - Banir membro
${prefix}advertir @usuario motivo - Advertir
${prefix}checkwarnings @usuario - Ver advertencias
${prefix}removewarning @usuario - Remover advertencia
${prefix}clearwarnings @usuario - Limpar advertencias
${prefix}mute @usuario - Silenciar membro
${prefix}desmute @usuario - Desmutar membro
${prefix}promover @usuario - Promover a admin
${prefix}rebaixar @usuario - Rebaixar admin

*Grupo:*
${prefix}fechargp - Fechar grupo (so admins)
${prefix}abrirgp - Abrir grupo (todos)
${prefix}nomegp texto - Alterar nome
${prefix}descgp texto - Alterar descricao
${prefix}linkgp - Link do grupo
${prefix}tagall - Marcar todos
${prefix}marcar texto - Marcar todos com mensagem
${prefix}banghost - Banir fantasmas

*Protecoes:*
${prefix}antilink - Anti-link on/off
${prefix}antifake - Anti-fake on/off
${prefix}antipalavra - Anti-palavrao on/off
${prefix}antiflood - Anti-flood on/off
${prefix}soadm - Modo so admins on/off
${prefix}autosticker - Auto sticker on/off
${prefix}autodl - Auto download on/off

*Listas:*
${prefix}listanegra numero - Add lista negra
${prefix}tirardalista numero - Remover lista negra
${prefix}listaban - Ver banidos
${prefix}advertidos - Ver advertidos
${prefix}inativos dias - Ver inativos

*Palavroes:*
${prefix}addpalavra palavra - Add palavrao
${prefix}delpalavra palavra - Remover palavrao
${prefix}listapalavrao - Ver lista

*Notas:*
${prefix}anotar texto - Salvar nota
${prefix}anotacao - Ver notas
${prefix}tirar_nota indice - Remover nota

*Mensagens:*
${prefix}mensagem-automatica HH:MM texto - Agendar
${prefix}listar-mensagens-automaticas - Ver agendadas
${prefix}limpar-agendadas - Limpar agendadas

*Welcome/Goodbye:*
${prefix}bemvindo on/off - Ativar boas-vindas
${prefix}legendabv texto - Legenda boas-vindas
${prefix}legendasaiu texto - Legenda saida

*Cargos:*
${prefix}cargo @usuario cargo - Definir cargo
${prefix}cargos - Ver cargos disponiveis
`.trim()
}

function generateGoldMenu(prefix) {
  return `
*MENU GOLD / ECONOMIA*

${prefix}gold - Ver seu saldo
${prefix}rankgold - Ranking de gold
${prefix}daily - Recompensa diaria
${prefix}doargold @usuario valor - Doar gold
${prefix}roubargold @usuario - Tentar roubar
${prefix}minerar_gold - Minerar gold
${prefix}cassino valor - Apostar no cassino
${prefix}roletadasorte valor - Roleta da sorte
${prefix}jackpotgold valor - Jackpot
${prefix}doublegold valor cor - Double
${prefix}sorteiogold - Sorteio de gold (ADM)
${prefix}addgold @usuario valor - Add gold (ADM)
${prefix}zerar_gold @usuario - Zerar gold (ADM)
`.trim()
}

function generateDownloadMenu(prefix) {
  return `
*MENU DOWNLOAD*

${prefix}play musica - Baixar musica (audio)
${prefix}playvideo musica - Baixar video do YT
${prefix}playdoc musica - Baixar como documento
${prefix}tiktok url - Baixar TikTok
${prefix}instagram url - Baixar Instagram
${prefix}twitter url - Baixar Twitter/X
${prefix}pinterest texto - Buscar no Pinterest
${prefix}spotify url - Baixar do Spotify
${prefix}mediafire url - Baixar do MediaFire
${prefix}facebook url - Baixar do Facebook
${prefix}letra musica - Buscar letra
${prefix}ytsearch texto - Buscar no YouTube
`.trim()
}

function generateStickerMenu(prefix) {
  return `
*MENU FIGURINHAS*

${prefix}sticker - Criar figurinha (envie img/vid)
${prefix}s - Atalho para sticker
${prefix}toimg - Figurinha para imagem
${prefix}togif - Figurinha animada para GIF
${prefix}ttp texto - Texto para figurinha
${prefix}attp texto - Texto animado para figurinha
${prefix}take pack autor - Alterar pack da fig
${prefix}rename pack|autor - Renomear figurinha
${prefix}qc texto - Quote chat figurinha
${prefix}figanime - Figurinha anime aleatoria
${prefix}figmeme - Figurinha meme aleatoria
${prefix}figemoji - Figurinha emoji
${prefix}sfundo - Remover fundo
`.trim()
}

function generateFunMenu(prefix) {
  return `
*MENU BRINCADEIRAS*

${prefix}ppt pedra/papel/tesoura - Pedra Papel Tesoura
${prefix}jogodavelha @usuario - Jogo da Velha
${prefix}roleta - Roleta russa
${prefix}sorteio - Sortear membro aleatorio
${prefix}chance texto - Chance de algo
${prefix}rankgay - Ranking gay
${prefix}rankgado - Ranking gado
${prefix}rankcorno - Ranking corno
${prefix}rankgostoso - Ranking gostoso
${prefix}gadometro - Gadometro
${prefix}corno - Cornometro
${prefix}casal - Sortear casal
${prefix}ship @user1 @user2 - Ship dois membros
${prefix}pergunta - Pergunta aleatoria
${prefix}eujaeununca - Eu ja eu nunca
${prefix}porcentagem texto - Porcentagem aleatoria
${prefix}duelo @usuario - Desafiar para duelo
${prefix}iniciar_forca - Iniciar jogo da forca
`.trim()
}

function generateEffectsMenu(prefix) {
  return `
*MENU EFEITOS*

*Imagem (marque uma imagem):*
${prefix}blur - Efeito blur
${prefix}greyscale - Preto e branco
${prefix}sepia - Efeito sepia
${prefix}invert - Inverter cores
${prefix}circulo - Recorte circular

*Audio (marque um audio):*
${prefix}bass - Aumentar graves
${prefix}grave - Voz grave
${prefix}esquilo - Voz de esquilo
${prefix}estourar - Efeito estourado
${prefix}fast - Audio rapido
${prefix}slow - Audio lento
${prefix}reverse - Audio ao contrario
`.trim()
}

function generateInfoMenu(prefix) {
  return `
*MENU INFORMACOES*

${prefix}info - Info do bot
${prefix}grupoinfo - Info do grupo
${prefix}ping - Velocidade do bot
${prefix}dono - Contato do dono
${prefix}admins - Lista de admins
${prefix}rankativos - Ranking de ativos
${prefix}checkativo @usuario - Checar atividade
${prefix}rankfigurinhas - Rank de figurinhas
${prefix}status - Status das funcoes do grupo
${prefix}cargos - Ver cargos do grupo
`.trim()
}

function generateOwnerMenu(prefix) {
  return `
*MENU DONO DO BOT*

${prefix}ativarbot tempo - Ativar bot no grupo (ex: 30d, 24h)
${prefix}desativarbot - Desativar bot no grupo
${prefix}verificar_aluguel - Ver status do aluguel
${prefix}bc mensagem - Broadcast para todos os grupos
${prefix}join link - Entrar em grupo
${prefix}sairgp - Sair do grupo
${prefix}listanegraglobal num - Banir globalmente
${prefix}grupos - Listar todos os grupos
${prefix}banirtodos numero - Banir de todos os grupos
${prefix}setmaxwarn num - Definir max advertencias
${prefix}resetstats - Resetar estatisticas
`.trim()
}

function generateGroupMenu(prefix) {
  return `
*MENU GRUPO*

${prefix}rankativos - Ranking de membros mais ativos
${prefix}rankativosg - Ranking ativos global
${prefix}checkativo @user - Checar atividade de alguem
${prefix}rankfigurinhas - Rank de figurinhas enviadas
${prefix}ultimosativos - Ultimos membros ativos
${prefix}inativos dias - Listar membros inativos
${prefix}admins - Listar administradores
${prefix}grupoinfo - Informacoes do grupo
${prefix}emcomum @user - Grupos em comum
`.trim()
}

// ============================================
// CONEXAO WHATSAPP
// ============================================
let sock = null
let botStartTime = Date.now()

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    browser: ['DEMI BOT', 'Chrome', '4.0.0'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 250,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id)
        return msg?.message || undefined
      }
      return { conversation: '' }
    },
  })

  store.bind(sock.ev)

  // Eventos de conexao
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      console.log('[DEMI BOT] Escaneie o QR Code acima para conectar!')
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('[DEMI BOT] Conexao fechada. Reconectando:', shouldReconnect)
      if (shouldReconnect) {
        await sleep(3000)
        startBot()
      } else {
        console.log('[DEMI BOT] Deslogado. Delete a pasta session e escaneie novamente.')
      }
    }
    if (connection === 'open') {
      console.log('[DEMI BOT] Conectado com sucesso!')
      botStartTime = Date.now()
      incrementStat('connections')
      await sock.sendMessage(CONFIG.ownerJid, {
        text: `*${CONFIG.botName} conectado com sucesso!*\n\nData: ${formatDate(Date.now())}\nGrupos ativos: ${Object.keys(db.rental.getAll()).length}`
      }).catch(() => {})
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // ============================================
  // HANDLER DE MENSAGENS
  // ============================================
  sock.ev.on('messages.upsert', async (upsert) => {
    const msgs = upsert.messages || upsert
    const type = upsert.type || 'notify'
    if (type !== 'notify') return
    for (const msg of msgs) {
      try {
        await handleMessage(msg)
      } catch (err) {
        console.error('[DEMI BOT] Erro ao processar mensagem:', err.message, err.stack)
      }
    }
  })

  // ============================================
  // HANDLER DE EVENTOS DO GRUPO (entrada/saida)
  // ============================================
  sock.ev.on('group-participants.update', async (event) => {
    try {
      await handleGroupEvent(event)
    } catch (err) {
      console.error('[DEMI BOT] Erro no evento de grupo:', err.message)
    }
  })

  // Verificacao periodica de aluguel
  setInterval(async () => {
    await checkAllRentals()
  }, 60 * 1000)

  // Mensagens agendadas
  setInterval(async () => {
    await processScheduledMessages()
  }, 30 * 1000)
}

// ============================================
// VERIFICAR TODOS OS ALUGUEIS
// ============================================
async function checkAllRentals() {
  const allRentals = db.rental.getAll()
  const now = Date.now()

  for (const [groupId, rental] of Object.entries(allRentals)) {
    if (!rental.active) continue

    const remaining = rental.expireAt - now
    const oneDay = 24 * 60 * 60 * 1000
    const threeDay = 3 * oneDay
    const oneHour = 60 * 60 * 1000

    if (remaining <= threeDay && remaining > oneDay && !rental.notified3d) {
      rental.notified3d = true
      db.rental.set(groupId, rental)
      await sock.sendMessage(groupId, {
        text: `*[DEMI BOT - AVISO DE EXPIRACAO]*\n\nO plano deste grupo expira em *3 dias*!\nTempo restante: ${timeRemaining(rental.expireAt)}\n\nRenove com o dono para continuar usando o bot.`
      }).catch(() => {})
    }

    if (remaining <= oneDay && remaining > oneHour && !rental.notified1d) {
      rental.notified1d = true
      db.rental.set(groupId, rental)
      await sock.sendMessage(groupId, {
        text: `*[DEMI BOT - AVISO URGENTE]*\n\nO plano deste grupo expira em *1 dia*!\nTempo restante: ${timeRemaining(rental.expireAt)}\n\nRenove AGORA para nao perder as funcoes!`
      }).catch(() => {})
    }

    if (remaining <= oneHour && remaining > 0 && !rental.notified1h) {
      rental.notified1h = true
      db.rental.set(groupId, rental)
      await sock.sendMessage(groupId, {
        text: `*[DEMI BOT - ULTIMO AVISO]*\n\nO plano deste grupo expira em *1 hora*!\nTempo restante: ${timeRemaining(rental.expireAt)}\n\nApos expirar, o bot deixara de funcionar neste grupo.`
      }).catch(() => {})
    }

    if (remaining <= 0) {
      rental.active = false
      db.rental.set(groupId, rental)
      await sock.sendMessage(groupId, {
        text: `*[DEMI BOT - PLANO EXPIRADO]*\n\nO plano deste grupo expirou!\n\nO bot nao respondera mais comandos aqui.\nEntre em contato com o dono para renovar:\nwa.me/${CONFIG.ownerNumber}`
      }).catch(() => {})
    }
  }
}

// ============================================
// PROCESSAR MENSAGENS AGENDADAS
// ============================================
async function processScheduledMessages() {
  const allGroups = db.scheduled.getAll()
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()

  for (const [groupId, msgs] of Object.entries(allGroups)) {
    for (const msg of msgs) {
      if (!msg.active) continue
      if (msg.hour !== hour || msg.minute !== minute) continue
      if (!msg.days.includes(dayOfWeek)) continue
      if (now.getTime() - msg.lastSent < 60000) continue

      msg.lastSent = now.getTime()
      if (msg.oneTime) msg.active = false
      db.scheduled.set(groupId, msgs)

      try {
        if (msg.media) {
          await sock.sendMessage(groupId, { image: { url: msg.media }, caption: msg.text || '' })
        } else {
          await sock.sendMessage(groupId, { text: msg.text })
        }
      } catch (e) {
        console.error('[DEMI BOT] Erro ao enviar mensagem agendada:', e.message)
      }
    }
  }
}

// ============================================
// HANDLER DE EVENTOS DE GRUPO
// ============================================
async function handleGroupEvent(event) {
  const { id: groupId, participants, action } = event
  const config = getGroupConfig(groupId)
  const rental = checkRental(groupId)

  // Permitir eventos se o aluguel esta ativo
  if (!rental.active) return

  const metadata = await sock.groupMetadata(groupId).catch(() => null)
  if (!metadata) return

  for (const participant of participants) {
    if (action === 'add') {
      if (isBlacklisted(participant)) {
        await sock.groupParticipantsUpdate(groupId, [participant], 'remove').catch(() => {})
        await sock.sendMessage(groupId, {
          text: `O numero @${formatPhone(participant)} esta na lista negra e foi removido automaticamente.`,
          mentions: [participant]
        }).catch(() => {})
        continue
      }

      if (config.antifake && !participant.startsWith('55')) {
        await sock.groupParticipantsUpdate(groupId, [participant], 'remove').catch(() => {})
        await sock.sendMessage(groupId, {
          text: `Numero estrangeiro detectado: @${formatPhone(participant)}. Removido pelo anti-fake.`,
          mentions: [participant]
        }).catch(() => {})
        continue
      }

      if (config.welcome) {
        const welcomeText = config.welcomeMsg ||
          `Seja bem-vindo(a) ao grupo *${metadata.subject}*!\n\n@${formatPhone(participant)}\n\nLeia as regras e use *#menu* para ver os comandos disponiveis.`

        let ppUrl = null
        try { ppUrl = await sock.profilePictureUrl(participant, 'image') } catch {}

        if (ppUrl) {
          await sock.sendMessage(groupId, {
            image: { url: ppUrl },
            caption: welcomeText,
            mentions: [participant]
          }).catch(() => {})
        } else {
          await sock.sendMessage(groupId, {
            text: welcomeText,
            mentions: [participant]
          }).catch(() => {})
        }
      }
    }

    if (action === 'remove') {
      if (config.goodbye) {
        const goodbyeText = config.goodbyeMsg ||
          `@${formatPhone(participant)} saiu do grupo *${metadata.subject}*. Ate mais!`
        await sock.sendMessage(groupId, {
          text: goodbyeText,
          mentions: [participant]
        }).catch(() => {})
      }
    }
  }
}

// ============================================
// FUNCAO PARA EXTRAIR CORPO DA MENSAGEM
// ============================================
function extractBody(msg) {
  const type = getContentType(msg.message)
  if (!type) return ''
  if (type === 'conversation') return msg.message.conversation
  if (type === 'extendedTextMessage') return msg.message.extendedTextMessage?.text
  if (type === 'imageMessage') return msg.message.imageMessage?.caption
  if (type === 'videoMessage') return msg.message.videoMessage?.caption
  if (type === 'documentMessage') return msg.message.documentMessage?.caption
  return ''
}

// ============================================
// FUNCAO PARA DOWNLOAD DE MIDIA
// ============================================
async function downloadMediaMessage(msg) {
  try {
    const type = getContentType(msg.message)
    const quotedMsg2 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    let mediaMsg = null

    if (type === 'imageMessage') mediaMsg = msg.message.imageMessage
    else if (type === 'videoMessage') mediaMsg = msg.message.videoMessage
    else if (type === 'stickerMessage') mediaMsg = msg.message.stickerMessage
    else if (type === 'audioMessage') mediaMsg = msg.message.audioMessage
    else if (type === 'documentMessage') mediaMsg = msg.message.documentMessage
    else if (quotedMsg2) {
      const qType = getContentType(quotedMsg2)
      if (qType === 'imageMessage') mediaMsg = quotedMsg2.imageMessage
      else if (qType === 'videoMessage') mediaMsg = quotedMsg2.videoMessage
      else if (qType === 'stickerMessage') mediaMsg = quotedMsg2.stickerMessage
      else if (qType === 'audioMessage') mediaMsg = quotedMsg2.audioMessage
    }

    if (!mediaMsg) return null

    const downloadFn = baileys.downloadMediaMessage || baileys.downloadContentFromMessage
    if (downloadFn) {
      const stream = await downloadFn(
        { key: msg.key, message: msg.message },
        'buffer',
        {}
      )
      return stream
    }
    return null
  } catch (e) {
    console.error('[DEMI BOT] Erro ao baixar midia:', e.message)
    return null
  }
}

// ============================================
// HANDLER PRINCIPAL DE MENSAGENS
// ============================================
async function handleMessage(msg) {
  if (!msg.message) return
  if (msg.key.fromMe) return
  if (msg.key.remoteJid === 'status@broadcast') return

  const chatId = msg.key.remoteJid
  const isGrp = isGroup(chatId)
  const senderId = msg.key.participant || msg.key.remoteJid
  const senderNumber = formatPhone(senderId)

  // ==========================================
  // FIX PRINCIPAL: Extrair mentionedJid, quotedParticipant, quotedMsg
  // Essas variaveis sao usadas em quase todos os comandos
  // ==========================================
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                      msg.message?.imageMessage?.contextInfo ||
                      msg.message?.videoMessage?.contextInfo ||
                      msg.message?.stickerMessage?.contextInfo ||
                      msg.message?.documentMessage?.contextInfo ||
                      {}

  const mentionedJid = contextInfo.mentionedJid || []
  const quotedParticipant = contextInfo.participant || null
  const quotedMsg = contextInfo.quotedMessage || null

  console.log(`[DEMI BOT] handleMessage | chat: ${chatId} | sender: ${senderNumber} | isGroup: ${isGrp} | isOwner: ${isOwnerNumber(senderNumber)} | mentions: ${mentionedJid.length}`)

  // Dono tem acesso total em qualquer lugar (grupo ou privado)
  const isOwnerMsg = isOwnerNumber(senderNumber)

  // Bot so funciona em grupos (exceto dono)
  if (!isGrp && !isOwnerMsg) return

  // Verificar aluguel do grupo (dono sempre tem acesso)
  if (isGrp && !isOwnerMsg) {
    const rental = checkRental(chatId)
    if (!rental.active) {
      const bodyText = extractBody(msg)
      if (!bodyText) return
      const prefixUsed = CONFIG.prefix.find(p => bodyText.startsWith(p))
      if (!prefixUsed) return
      const cmd = bodyText.slice(prefixUsed.length).trim().split(/\s+/)[0].toLowerCase()
      if (cmd !== 'ativarbot') return
    }
  }

  // Extrair texto da mensagem
  const body = extractBody(msg)
  if (!body && !msg.message.stickerMessage && !msg.message.imageMessage && !msg.message.videoMessage) return

  // Tracking de atividade
  if (isGrp) trackActivity(chatId, senderId)

  incrementStat('messagesProcessed')

  // Verificar AFK
  const afkData = db.afk.get(senderId)
  if (afkData) {
    db.afk.delete(senderId)
    await sock.sendMessage(chatId, {
      text: `@${senderNumber} voltou! Estava ausente: ${afkData.reason || 'Sem motivo'}`,
      mentions: [senderId]
    }).catch(() => {})
  }

  // Verificar mencao de AFK
  if (mentionedJid.length > 0) {
    for (const mentioned of mentionedJid) {
      const afk = db.afk.get(mentioned)
      if (afk) {
        await sock.sendMessage(chatId, {
          text: `@${formatPhone(mentioned)} esta ausente!\nMotivo: ${afk.reason || 'Nao informado'}\nDesde: ${formatDate(afk.since)}`,
          mentions: [mentioned]
        }).catch(() => {})
      }
    }
  }

  // Config do grupo
  const config = isGrp ? getGroupConfig(chatId) : {}

  // Verificar se e grupo e pegar metadata
  let groupMetadata = null
  let isAdmin = false
  let isBotAdmin = false

  if (isGrp) {
    groupMetadata = await sock.groupMetadata(chatId).catch(() => null)
    if (groupMetadata) {
      const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
      isAdmin = admins.includes(senderId)
      const botJid = jidNormalizedUser(sock.user?.id)
      isBotAdmin = admins.includes(botJid)
    }
  }

  const isOwner = isOwnerNumber(senderNumber)

  // ============================================
  // ANTI-SISTEMAS (verificar antes dos comandos)
  // ============================================
  if (isGrp && !isAdmin && !isOwner && body) {
    // Anti-link
    if (config.antilink && isUrl(body)) {
      const whitelist = config.linkWhitelist || []
      const isWhitelisted = whitelist.some(domain => body.includes(domain))
      if (!isWhitelisted && isBotAdmin) {
        await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {})
        const warns = addWarning(chatId, senderId, 'Envio de link')
        const maxW = config.maxWarnings || 3
        if (warns >= maxW) {
          await sock.groupParticipantsUpdate(chatId, [senderId], 'remove').catch(() => {})
          addToBlacklist(senderNumber, 'Max advertencias por links', 'bot')
          await sock.sendMessage(chatId, {
            text: `@${senderNumber} foi removido por excesso de advertencias (${warns}/${maxW}).\nMotivo: Envio de links.`,
            mentions: [senderId]
          }).catch(() => {})
        } else {
          await sock.sendMessage(chatId, {
            text: `@${senderNumber}, links nao sao permitidos neste grupo!\nAdvertencia ${warns}/${maxW}`,
            mentions: [senderId]
          }).catch(() => {})
        }
        return
      }
    }

    // Anti-palavrao
    if (config.antipalavra && body) {
      const found = checkBadwords(chatId, body)
      if (found) {
        await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {})
        const warns = addWarning(chatId, senderId, `Palavrao: ${found}`)
        const maxW = config.maxWarnings || 3
        await sock.sendMessage(chatId, {
          text: `@${senderNumber}, palavroes nao sao permitidos!\nAdvertencia ${warns}/${maxW}`,
          mentions: [senderId]
        }).catch(() => {})
        if (warns >= maxW && isBotAdmin) {
          await sock.groupParticipantsUpdate(chatId, [senderId], 'remove').catch(() => {})
          addToBlacklist(senderNumber, 'Max advertencias por palavroes', 'bot')
        }
        return
      }
    }

    // Limite de texto
    if (config.limitexto > 0 && body.length > config.limitexto) {
      await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {})
      await sock.sendMessage(chatId, {
        text: `@${senderNumber}, mensagem muito longa! Limite: ${config.limitexto} caracteres.`,
        mentions: [senderId]
      }).catch(() => {})
      return
    }

    // So admin
    if (config.soadm) return
  }

  // Auto sticker
  if (isGrp && config.autosticker && !body) {
    if (msg.message.imageMessage || msg.message.videoMessage) {
      try {
        const media = await downloadMediaMessage(msg)
        if (media) {
          await sock.sendMessage(chatId, {
            sticker: media,
            mimetype: 'image/webp'
          }).catch(() => {})
        }
      } catch {}
    }
  }

  // ============================================
  // PROCESSAR COMANDOS
  // ============================================
  if (!body) return

  const groupConfig = isGrp ? getGroupConfig(chatId) : { prefix: '#', multiprefix: true }
  const validPrefixes = groupConfig.multiprefix ? CONFIG.prefix : [groupConfig.prefix || '#']
  const prefixUsed = validPrefixes.find(p => body.startsWith(p))
  if (!prefixUsed) return

  const fullCmd = body.slice(prefixUsed.length).trim()
  if (!fullCmd) return

  const args = fullCmd.split(/\s+/)
  const command = args.shift().toLowerCase()
  const text = args.join(' ')

  incrementStat('commandsProcessed')

  // Helper para responder (com retry para erro "No sessions")
  const reply = async (txt) => {
    try {
      await sock.sendMessage(chatId, { text: txt }, { quoted: msg })
    } catch (e) {
      if (e.message === 'No sessions' || e.message?.includes('session')) {
        try {
          await delay(1500)
          await sock.sendMessage(chatId, { text: txt })
        } catch (e2) {
          console.error('[DEMI BOT] Falha no retry:', e2.message)
        }
      } else {
        console.error('[DEMI BOT] Erro ao responder:', e.message)
      }
    }
  }

  const replyMention = async (txt, mentions = []) => {
    try {
      await sock.sendMessage(chatId, { text: txt, mentions }, { quoted: msg })
    } catch (e) {
      if (e.message === 'No sessions' || e.message?.includes('session')) {
        try {
          await delay(1500)
          await sock.sendMessage(chatId, { text: txt, mentions })
        } catch (e2) {
          console.error('[DEMI BOT] Falha no retry mention:', e2.message)
        }
      } else {
        console.error('[DEMI BOT] Erro ao responder com mention:', e.message)
      }
    }
  }

  // ============================================
  // ROTEADOR DE COMANDOS
  // ============================================
  try {
    switch (command) {

      // ==================== INFORMACAO ====================
      case 'menu': {
        const subMenu = text.toLowerCase()
        let menuText = ''
        switch (subMenu) {
          case 'adm': menuText = generateAdminMenu(prefixUsed); break
          case 'gold': menuText = generateGoldMenu(prefixUsed); break
          case 'download': case 'baixar': menuText = generateDownloadMenu(prefixUsed); break
          case 'figurinhas': case 'sticker': case 'fig': menuText = generateStickerMenu(prefixUsed); break
          case 'brincadeiras': case 'fun': menuText = generateFunMenu(prefixUsed); break
          case 'efeitos': menuText = generateEffectsMenu(prefixUsed); break
          case 'info': menuText = generateInfoMenu(prefixUsed); break
          case 'dono': case 'owner':
            if (!isOwner) return reply('Apenas o dono pode acessar este menu.')
            menuText = generateOwnerMenu(prefixUsed); break
          case 'grupo': menuText = generateGroupMenu(prefixUsed); break
          case 'jogos': menuText = generateFunMenu(prefixUsed); break
          default: menuText = generateMainMenu(chatId, prefixUsed); break
        }
        await reply(menuText)
        break
      }

      case 'ping': case 'ping2': case 'ping3': {
        const start = Date.now()
        const uptime = Date.now() - botStartTime
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24))
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const mins = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
        await reply(`*PONG!*\nLatencia: ${Date.now() - start}ms\nUptime: ${days}d ${hours}h ${mins}m\nGrupos: ${Object.keys(db.rental.getAll()).length}`)
        break
      }

      case 'info': case 'infobot': {
        const stats = db.stats.get('global', {})
        await reply(`*${CONFIG.botName}*\n\nDono: wa.me/${CONFIG.ownerNumber}\nPrefixos: ${CONFIG.prefix.join(', ')}\nMensagens processadas: ${stats.messagesProcessed || 0}\nComandos executados: ${stats.commandsProcessed || 0}\nConexoes: ${stats.connections || 0}`)
        break
      }

      case 'dono': case 'criador': case 'donos': {
        await reply(`*Dono do ${CONFIG.botName}:*\nwa.me/${CONFIG.ownerNumber}`)
        break
      }

      case 'ajuda': case 'help': case 'configurarbot': {
        await reply(`*Como usar o ${CONFIG.botName}*\n\n1. Use ${prefixUsed}menu para ver todos os menus\n2. Use ${prefixUsed}menu adm para comandos de admin\n3. Use ${prefixUsed}status para ver funcoes ativas\n4. Prefixos aceitos: ${CONFIG.prefix.join(', ')}\n\n*Cargos:*\nDono > Administrador > Moderador > Auxiliar > Membro\n\nCada cargo tem acesso a diferentes funcoes.`)
        break
      }

      // ==================== DONO DO BOT ====================
      case 'ativarbot': {
        if (!isOwner) return reply('Apenas o dono do bot pode usar este comando.')
        if (!isGrp) return reply('Use este comando em um grupo.')
        if (!text) return reply(`Use: ${prefixUsed}ativarbot <tempo>\nExemplo: ${prefixUsed}ativarbot 30d (30 dias)\n${prefixUsed}ativarbot 24h (24 horas)\n${prefixUsed}ativarbot 30min (30 minutos)`)
        const expireAt = activateRental(chatId, text, senderNumber)
        if (!expireAt) return reply('Formato invalido! Use: 30min, 24h, 30d, etc.')
        await reply(`*Bot ativado com sucesso!*\n\nDuracao: ${text}\nExpira em: ${formatDate(expireAt)}\nTempo restante: ${timeRemaining(expireAt)}`)
        break
      }

      case 'desativarbot': {
        if (!isOwner) return reply('Apenas o dono do bot pode usar este comando.')
        const rental = db.rental.get(chatId)
        if (rental) {
          rental.active = false
          db.rental.set(chatId, rental)
        }
        await reply('Bot desativado neste grupo.')
        break
      }

      case 'verificar_aluguel': case 'aluguel': {
        if (!isOwner && !isAdmin) return reply('Sem permissao.')
        const rentalInfo = getRentalInfo(chatId)
        if (!rentalInfo) return reply('Nenhum plano ativo neste grupo.')
        await reply(`*Status do Aluguel*\n\nAtivado em: ${formatDate(rentalInfo.activatedAt)}\nExpira em: ${formatDate(rentalInfo.expireAt)}\nDuracao: ${rentalInfo.duration}\nTempo restante: ${rentalInfo.remaining}\nStatus: ${rentalInfo.isExpired ? 'EXPIRADO' : 'ATIVO'}`)
        break
      }

      case 'bc': {
        if (!isOwner) return reply('Apenas o dono.')
        if (!text) return reply(`Use: ${prefixUsed}bc mensagem`)
        const allRentals = db.rental.getAll()
        let count = 0
        for (const [gid, rental] of Object.entries(allRentals)) {
          if (rental.active) {
            await sock.sendMessage(gid, { text: `*[BROADCAST - ${CONFIG.botName}]*\n\n${text}` }).catch(() => {})
            count++
            await sleep(1000)
          }
        }
        await reply(`Broadcast enviado para ${count} grupos.`)
        break
      }

      case 'join': {
        if (!isOwner) return reply('Apenas o dono.')
        if (!text) return reply(`Use: ${prefixUsed}join link`)
        const code = text.replace('https://chat.whatsapp.com/', '')
        await sock.groupAcceptInvite(code).then(() => reply('Entrei no grupo!')).catch(() => reply('Nao consegui entrar.'))
        break
      }

      case 'sairgp': case 'exitgp': case 'sairdogp': {
        if (!isOwner) return reply('Apenas o dono.')
        await reply('Saindo do grupo...')
        await sock.groupLeave(chatId).catch(() => {})
        break
      }

      case 'grupos': {
        if (!isOwner) return reply('Apenas o dono.')
        const groups = await sock.groupFetchAllParticipating().catch(() => ({}))
        const list = Object.values(groups)
        let txt = `*Grupos (${list.length}):*\n\n`
        list.forEach((g, i) => {
          const rentalG = getRentalInfo(g.id)
          txt += `${i + 1}. ${g.subject}\n   Membros: ${g.participants?.length || 0}\n   Status: ${rentalG?.isExpired === false ? 'ATIVO' : 'INATIVO'}\n\n`
        })
        await reply(txt)
        break
      }

      // ==================== ADMINISTRACAO ====================
      case 'ban': case 'kick': case 'remover': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const target = mentionedJid[0] || quotedParticipant
        if (!target) return reply(`Use: ${prefixUsed}ban @usuario`)
        if (isOwnerNumber(formatPhone(target))) return reply('Nao posso banir o dono do bot.')
        await sock.groupParticipantsUpdate(chatId, [target], 'remove')
        await replyMention(`@${formatPhone(target)} foi removido do grupo.`, [target])
        break
      }

      case 'add': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const num = text.replace(/[^0-9]/g, '')
        if (!num) return reply(`Use: ${prefixUsed}add 5592999999999`)
        const jid = formatJid(num)
        if (isBlacklisted(jid)) return reply('Este numero esta na lista negra.')
        await sock.groupParticipantsUpdate(chatId, [jid], 'add')
          .then(() => reply(`${num} adicionado ao grupo.`))
          .catch(() => reply('Nao foi possivel adicionar. O numero pode ter bloqueado convites.'))
        break
      }

      case 'advertir': case 'warn': case 'adverter': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        const target2 = mentionedJid[0] || quotedParticipant
        if (!target2) return reply(`Use: ${prefixUsed}advertir @usuario motivo`)
        const reason = args.join(' ') || 'Sem motivo especificado'
        const warnCount = addWarning(chatId, target2, reason)
        const maxW = config.maxWarnings || 3
        if (warnCount >= maxW && isBotAdmin) {
          await sock.groupParticipantsUpdate(chatId, [target2], 'remove').catch(() => {})
          addToBlacklist(formatPhone(target2), `Max advertencias: ${reason}`, senderNumber)
          await replyMention(`@${formatPhone(target2)} atingiu o limite de ${maxW} advertencias e foi removido!\nAdicionado a lista negra.`, [target2])
        } else {
          await replyMention(`@${formatPhone(target2)} recebeu uma advertencia (${warnCount}/${maxW})\nMotivo: ${reason}`, [target2])
        }
        break
      }

      case 'checkwarnings': case 'ver_adv': {
        if (!isGrp) return reply('Apenas em grupos.')
        const target3 = mentionedJid[0] || quotedParticipant
        if (!target3) return reply(`Use: ${prefixUsed}checkwarnings @usuario`)
        const warns = getWarnings(chatId, target3)
        if (warns.length === 0) return replyMention(`@${formatPhone(target3)} nao tem advertencias.`, [target3])
        let warnText = `*Advertencias de @${formatPhone(target3)}:*\n\n`
        warns.forEach((w, i) => { warnText += `${i + 1}. ${w.reason} - ${formatDate(w.date)}\n` })
        await replyMention(warnText, [target3])
        break
      }

      case 'removewarning': case 'removewarnings': case 'rm_adv': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        const target4 = mentionedJid[0] || quotedParticipant
        if (!target4) return reply(`Use: ${prefixUsed}removewarning @usuario`)
        const remaining = removeWarning(chatId, target4)
        await replyMention(`Advertencia removida de @${formatPhone(target4)}. Total restante: ${remaining}`, [target4])
        break
      }

      case 'clearwarnings': case 'limpar_adv': case 'limparadv': case 'limparavisos': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const target5 = mentionedJid[0] || quotedParticipant
        if (target5) {
          clearWarnings(chatId, target5)
          await replyMention(`Advertencias de @${formatPhone(target5)} foram limpas.`, [target5])
        } else {
          const allKeys = Object.keys(db.warnings.getAll())
          allKeys.filter(k => k.startsWith(chatId)).forEach(k => db.warnings.delete(k))
          await reply('Todas as advertencias do grupo foram limpas.')
        }
        break
      }

      case 'advertidos': case 'lista_adv': {
        if (!isGrp) return reply('Apenas em grupos.')
        const allWarns = db.warnings.getAll()
        const groupWarns = Object.entries(allWarns).filter(([k]) => k.startsWith(chatId))
        if (groupWarns.length === 0) return reply('Nenhum membro advertido.')
        let warnListText = '*Membros advertidos:*\n\n'
        const warnMentions = []
        groupWarns.forEach(([key, warnsList]) => {
          if (warnsList.length > 0) {
            const userId = key.replace(chatId + '_', '')
            warnMentions.push(userId)
            warnListText += `@${formatPhone(userId)} - ${warnsList.length} advertencia(s)\n`
          }
        })
        await replyMention(warnListText, warnMentions)
        break
      }

      case 'promover': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const target6 = mentionedJid[0] || quotedParticipant
        if (!target6) return reply(`Use: ${prefixUsed}promover @usuario`)
        await sock.groupParticipantsUpdate(chatId, [target6], 'promote')
        await replyMention(`@${formatPhone(target6)} foi promovido a admin.`, [target6])
        break
      }

      case 'rebaixar': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const target7 = mentionedJid[0] || quotedParticipant
        if (!target7) return reply(`Use: ${prefixUsed}rebaixar @usuario`)
        await sock.groupParticipantsUpdate(chatId, [target7], 'demote')
        await replyMention(`@${formatPhone(target7)} foi rebaixado.`, [target7])
        break
      }

      case 'mute': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const target8 = mentionedJid[0] || quotedParticipant
        if (!target8) return reply(`Use: ${prefixUsed}mute @usuario`)
        const mutedList = db.groups.get(`muted_${chatId}`, [])
        if (!mutedList.includes(target8)) mutedList.push(target8)
        db.groups.set(`muted_${chatId}`, mutedList)
        await replyMention(`@${formatPhone(target8)} foi silenciado.`, [target8])
        break
      }

      case 'desmute': case 'unmute': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        const target9 = mentionedJid[0] || quotedParticipant
        if (!target9) return reply(`Use: ${prefixUsed}desmute @usuario`)
        let mutedList2 = db.groups.get(`muted_${chatId}`, [])
        mutedList2 = mutedList2.filter(id => id !== target9)
        db.groups.set(`muted_${chatId}`, mutedList2)
        await replyMention(`@${formatPhone(target9)} foi desmutado.`, [target9])
        break
      }

      case 'fechargp': case 'colloportus': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        await sock.groupSettingUpdate(chatId, 'announcement')
        await reply('Grupo fechado! Apenas admins podem enviar mensagens.')
        break
      }

      case 'abrirgp': case 'alohomora': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        await sock.groupSettingUpdate(chatId, 'not_announcement')
        await reply('Grupo aberto! Todos podem enviar mensagens.')
        break
      }

      case 'nomegp': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        if (!text) return reply(`Use: ${prefixUsed}nomegp novo nome`)
        await sock.groupUpdateSubject(chatId, text)
        await reply(`Nome do grupo alterado para: ${text}`)
        break
      }

      case 'descgp': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        if (!text) return reply(`Use: ${prefixUsed}descgp nova descricao`)
        await sock.groupUpdateDescription(chatId, text)
        await reply('Descricao do grupo atualizada!')
        break
      }

      case 'linkgp': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        const link = await sock.groupInviteCode(chatId)
        await reply(`*Link do grupo:*\nhttps://chat.whatsapp.com/${link}`)
        break
      }

      case 'tagall': case 'marcar': case 'marcar2': case 'totag': case 'hidetag': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        if (!groupMetadata) return reply('Erro ao obter dados do grupo.')
        const participants = groupMetadata.participants.map(p => p.id)
        let tagText = text || 'Atencao todos!'
        tagText += '\n\n'
        participants.forEach(p => { tagText += `@${formatPhone(p)} ` })
        await sock.sendMessage(chatId, { text: tagText, mentions: participants })
        break
      }

      case 'admins': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!groupMetadata) return reply('Erro ao obter dados do grupo.')
        const adminList = groupMetadata.participants.filter(p => p.admin)
        let adminText = '*Administradores:*\n\n'
        const adminMentions = []
        adminList.forEach(a => {
          adminMentions.push(a.id)
          adminText += `@${formatPhone(a.id)} - ${a.admin === 'superadmin' ? 'Dono' : 'Admin'}\n`
        })
        await replyMention(adminText, adminMentions)
        break
      }

      case 'grupoinfo': case 'gpinfo': case 'grupo': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!groupMetadata) return reply('Erro ao obter dados do grupo.')
        const g = groupMetadata
        const rentalGI = getRentalInfo(chatId)
        await reply(`*Informacoes do Grupo*\n\nNome: ${g.subject}\nID: ${g.id}\nDescricao: ${g.desc || 'Nenhuma'}\nMembros: ${g.participants.length}\nAdmins: ${g.participants.filter(p => p.admin).length}\nCriado em: ${formatDate(g.creation * 1000)}\n\n*Bot:*\nPlano: ${rentalGI ? rentalGI.duration : 'Sem plano'}\nStatus: ${rentalGI && !rentalGI.isExpired ? 'ATIVO' : 'INATIVO'}\nRestante: ${rentalGI ? rentalGI.remaining : '-'}`)
        break
      }

      case 'banghost': case 'ban_ghost': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        if (!groupMetadata) return reply('Erro.')
        let removed = 0
        for (const p of groupMetadata.participants) {
          if (p.admin) continue
          const act = db.activity.get(`${chatId}_${p.id}`)
          if (!act || act.messages === 0) {
            await sock.groupParticipantsUpdate(chatId, [p.id], 'remove').catch(() => {})
            removed++
            await sleep(1000)
          }
        }
        await reply(`${removed} fantasmas removidos.`)
        break
      }

      case 'inativos': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        const daysT = parseInt(text) || 7
        if (!groupMetadata) return reply('Erro.')
        const inactive = getInactiveMembers(chatId, groupMetadata.participants, daysT)
        if (inactive.length === 0) return reply(`Nenhum membro inativo ha mais de ${daysT} dias.`)
        let inactiveText = `*Membros inativos (${daysT} dias):*\n\n`
        const inactiveMentions = []
        inactive.slice(0, 30).forEach((m, i) => {
          inactiveMentions.push(m.user)
          inactiveText += `${i + 1}. @${formatPhone(m.user)} - ${m.lastSeen ? formatDate(m.lastSeen) : 'Nunca interagiu'}\n`
        })
        inactiveText += `\nTotal: ${inactive.length}`
        await replyMention(inactiveText, inactiveMentions)
        break
      }

      // ==================== PROTECOES ON/OFF ====================
      case 'antilink': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newState = !config.antilink
        setGroupConfig(chatId, 'antilink', newState)
        await reply(`Anti-link ${newState ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'antifake': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateAF = !config.antifake
        setGroupConfig(chatId, 'antifake', newStateAF)
        await reply(`Anti-fake ${newStateAF ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'antipalavra': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateAP = !config.antipalavra
        setGroupConfig(chatId, 'antipalavra', newStateAP)
        await reply(`Anti-palavrao ${newStateAP ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'antiflood': case 'advflood': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateAFL = !config.antiflood
        setGroupConfig(chatId, 'antiflood', newStateAFL)
        await reply(`Anti-flood ${newStateAFL ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'soadm': case 'so_adm': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateSA = !config.soadm
        setGroupConfig(chatId, 'soadm', newStateSA)
        await reply(`Modo so admins ${newStateSA ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'autosticker': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateAS = !config.autosticker
        setGroupConfig(chatId, 'autosticker', newStateAS)
        await reply(`Auto-sticker ${newStateAS ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'autodl': case 'autobaixar': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateAD = !config.autodl
        setGroupConfig(chatId, 'autodl', newStateAD)
        await reply(`Auto-download ${newStateAD ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'x9viewonce': case 'x9visuunica': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateX9 = !config.x9viewonce
        setGroupConfig(chatId, 'x9viewonce', newStateX9)
        await reply(`X9 visualizacao unica ${newStateX9 ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'bemvindo': case 'welcome': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateBV = !config.welcome
        setGroupConfig(chatId, 'welcome', newStateBV)
        await reply(`Boas-vindas ${newStateBV ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'multiprefix': case 'multiprefixo': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const newStateMP = !config.multiprefix
        setGroupConfig(chatId, 'multiprefix', newStateMP)
        await reply(`Multi-prefixo ${newStateMP ? 'ATIVADO' : 'DESATIVADO'}`)
        break
      }

      case 'status': case 'ativacoes': {
        if (!isGrp) return reply('Apenas em grupos.')
        const c = getGroupConfig(chatId)
        const on = 'ATIVO'
        const off = 'INATIVO'
        await reply(`*Status das funcoes:*\n\nAnti-link: ${c.antilink ? on : off}\nAnti-fake: ${c.antifake ? on : off}\nAnti-palavrao: ${c.antipalavra ? on : off}\nAnti-flood: ${c.antiflood ? on : off}\nAuto-sticker: ${c.autosticker ? on : off}\nAuto-download: ${c.autodl ? on : off}\nBoas-vindas: ${c.welcome ? on : off}\nSo admins: ${c.soadm ? on : off}\nX9 view-once: ${c.x9viewonce ? on : off}\nMulti-prefixo: ${c.multiprefix ? on : off}`)
        break
      }

      // ==================== PALAVROES ====================
      case 'addpalavra': case 'add_palavra': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}addpalavra palavra`)
        addBadword(chatId, text)
        await reply(`Palavra "${text}" adicionada a lista de palavroes.`)
        break
      }

      case 'delpalavra': case 'rm_palavra': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}delpalavra palavra`)
        removeBadword(chatId, text)
        await reply(`Palavra "${text}" removida da lista.`)
        break
      }

      case 'listapalavrao': case 'listapalavras': {
        if (!isGrp) return reply('Apenas em grupos.')
        const words = db.badwords.get(chatId, [])
        if (words.length === 0) return reply('Nenhum palavrao cadastrado.')
        await reply(`*Palavroes bloqueados:*\n\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`)
        break
      }

      // ==================== LISTA NEGRA ====================
      case 'listanegra': {
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin && !isOwner) return reply('Sem permissao.')
        if (!text) {
          const bl = db.blacklist.getAll()
          const entries = Object.entries(bl)
          if (entries.length === 0) return reply('Lista negra vazia.')
          let blText = '*Lista Negra:*\n\n'
          entries.forEach(([num, data], i) => {
            blText += `${i + 1}. ${num} - ${data.reason || 'Sem motivo'}\n`
          })
          await reply(blText)
        } else {
          const num = text.replace(/[^0-9]/g, '')
          addToBlacklist(num, 'Adicionado manualmente', senderNumber)
          await reply(`${num} adicionado a lista negra.`)
        }
        break
      }

      case 'tirardalista': case 'rmlistanegra': {
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin && !isOwner) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}tirardalista numero`)
        const numBL = text.replace(/[^0-9]/g, '')
        removeFromBlacklist(numBL)
        await reply(`${numBL} removido da lista negra.`)
        break
      }

      // ==================== NOTAS ====================
      case 'anotar': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}anotar texto`)
        addNote(chatId, text, senderNumber)
        await reply('Nota salva com sucesso!')
        break
      }

      case 'anotacao': case 'anotacoes': case 'notas': {
        if (!isGrp) return reply('Apenas em grupos.')
        const notes = getNotes(chatId)
        if (notes.length === 0) return reply('Nenhuma nota salva.')
        let notesText = '*Notas do grupo:*\n\n'
        notes.forEach((n, i) => { notesText += `${i + 1}. ${n.text}\n   Por: ${n.addedBy} - ${formatDate(n.date)}\n\n` })
        await reply(notesText)
        break
      }

      case 'tirar_nota': case 'rmnota': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        const idx = parseInt(text) - 1
        if (isNaN(idx)) return reply(`Use: ${prefixUsed}tirar_nota numero`)
        removeNote(chatId, idx)
        await reply('Nota removida!')
        break
      }

      // ==================== LEGENDAS ====================
      case 'legendabv': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}legendabv texto de boas vindas`)
        setGroupConfig(chatId, 'welcomeMsg', text)
        await reply('Mensagem de boas-vindas definida!')
        break
      }

      case 'legendasaiu': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!text) return reply(`Use: ${prefixUsed}legendasaiu texto de saida`)
        setGroupConfig(chatId, 'goodbyeMsg', text)
        await reply('Mensagem de saida definida!')
        break
      }

      // ==================== CARGOS ====================
      case 'cargo': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const target10 = mentionedJid[0] || quotedParticipant
        if (!target10 || !text) return reply(`Use: ${prefixUsed}cargo @usuario cargo\nCargos: administrador, moderador, auxiliar`)
        const roleName = args[args.length - 1]?.toLowerCase()
        const validRoles = ['administrador', 'moderador', 'auxiliar', 'membro']
        if (!validRoles.includes(roleName)) return reply(`Cargo invalido. Use: ${validRoles.join(', ')}`)
        if (roleName === 'membro') removeUserRole(chatId, target10)
        else setUserRole(chatId, target10, roleName)
        await replyMention(`@${formatPhone(target10)} recebeu o cargo de *${roleName}*`, [target10])
        break
      }

      case 'cargos': {
        if (!isGrp) return reply('Apenas em grupos.')
        const roles = db.roles.get(chatId, {})
        const roleEntries = Object.entries(roles)
        if (roleEntries.length === 0) return reply('Nenhum cargo atribuido neste grupo.')
        let rolesText = '*Cargos do grupo:*\n\n'
        const roleMentions = []
        roleEntries.forEach(([userId, role]) => {
          roleMentions.push(userId)
          rolesText += `@${formatPhone(userId)} - ${role}\n`
        })
        await replyMention(rolesText, roleMentions)
        break
      }

      // ==================== MENSAGENS AGENDADAS ====================
      case 'mensagem-automatica': case 'mensagem_automatica': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const matchTime = text.match(/^(\d{1,2}):(\d{2})\s+(.+)$/s)
        if (!matchTime) return reply(`Use: ${prefixUsed}mensagem-automatica HH:MM texto da mensagem`)
        const [, h, m, msgText] = matchTime
        addScheduledMessage(chatId, {
          text: msgText,
          hour: parseInt(h),
          minute: parseInt(m),
          createdBy: senderNumber
        })
        await reply(`Mensagem agendada para ${h}:${m} todos os dias!`)
        break
      }

      case 'listar-mensagens-automaticas': case 'mensagens-agendadas': {
        if (!isGrp) return reply('Apenas em grupos.')
        const sched = getScheduledMessages(chatId)
        if (sched.length === 0) return reply('Nenhuma mensagem agendada.')
        let schedText = '*Mensagens agendadas:*\n\n'
        sched.forEach((s, i) => {
          schedText += `${i + 1}. [${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}] ${s.text?.substring(0, 50) || 'Midia'}...\n   ID: ${s.id} | ${s.active ? 'Ativa' : 'Inativa'}\n\n`
        })
        await reply(schedText)
        break
      }

      case 'limpar-agendadas': case 'limpar-mensagens-automaticas': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        db.scheduled.set(chatId, [])
        await reply('Todas as mensagens agendadas foram removidas.')
        break
      }

      // ==================== GOLD / ECONOMIA ====================
      case 'gold': case 'mygold': {
        if (!isGrp) return reply('Apenas em grupos.')
        const goldAmount = getGold(chatId, senderId)
        await reply(`*Seu saldo:* ${goldAmount} gold`)
        break
      }

      case 'rankgold': {
        if (!isGrp) return reply('Apenas em grupos.')
        const ranking = getGoldRanking(chatId, 15)
        if (ranking.length === 0) return reply('Nenhum membro com gold.')
        let goldText = '*Ranking de Gold:*\n\n'
        const goldMentions = []
        ranking.forEach(r => {
          goldMentions.push(r.user)
          goldText += `${r.pos}. @${formatPhone(r.user)} - ${r.amount} gold\n`
        })
        await replyMention(goldText, goldMentions)
        break
      }

      case 'daily': case 'diario': {
        if (!isGrp) return reply('Apenas em grupos.')
        const lastDaily = db.gold.get(`daily_${chatId}_${senderId}`, 0)
        const oneDayMs = 24 * 60 * 60 * 1000
        if (Date.now() - lastDaily < oneDayMs) {
          const remaining2 = oneDayMs - (Date.now() - lastDaily)
          return reply(`Voce ja resgatou hoje! Volte em ${timeRemaining(Date.now() + remaining2)}`)
        }
        const amount = getRandom(50, 200)
        addGold(chatId, senderId, amount)
        db.gold.set(`daily_${chatId}_${senderId}`, Date.now())
        await reply(`*Recompensa diaria!*\nVoce ganhou ${amount} gold!`)
        break
      }

      case 'doargold': case 'doar_gold': {
        if (!isGrp) return reply('Apenas em grupos.')
        const targetDonate = mentionedJid[0]
        const donateAmount = parseInt(args[args.length - 1])
        if (!targetDonate || !donateAmount || donateAmount <= 0) return reply(`Use: ${prefixUsed}doargold @usuario valor`)
        if (!removeGold(chatId, senderId, donateAmount)) return reply('Saldo insuficiente!')
        addGold(chatId, targetDonate, donateAmount)
        await replyMention(`Voce doou ${donateAmount} gold para @${formatPhone(targetDonate)}!`, [targetDonate])
        break
      }

      case 'roubargold': case 'roubar_gold': {
        if (!isGrp) return reply('Apenas em grupos.')
        const targetRob = mentionedJid[0]
        if (!targetRob) return reply(`Use: ${prefixUsed}roubargold @usuario`)
        const success = Math.random() < 0.35
        if (success) {
          const stolen = getRandom(10, 50)
          const targetGold = getGold(chatId, targetRob)
          if (targetGold < stolen) return replyMention(`@${formatPhone(targetRob)} nao tem gold suficiente para roubar.`, [targetRob])
          removeGold(chatId, targetRob, stolen)
          addGold(chatId, senderId, stolen)
          await replyMention(`Voce roubou ${stolen} gold de @${formatPhone(targetRob)}!`, [targetRob])
        } else {
          const penalty = getRandom(20, 60)
          removeGold(chatId, senderId, penalty)
          await reply(`Voce foi pego tentando roubar e perdeu ${penalty} gold!`)
        }
        break
      }

      case 'minerar_gold': case 'minerar': {
        if (!isGrp) return reply('Apenas em grupos.')
        const lastMine = db.gold.get(`mine_${chatId}_${senderId}`, 0)
        if (Date.now() - lastMine < 5 * 60 * 1000) return reply('Espere 5 minutos para minerar novamente.')
        db.gold.set(`mine_${chatId}_${senderId}`, Date.now())
        const mined = getRandom(1, 30)
        addGold(chatId, senderId, mined)
        await reply(`Voce minerou ${mined} gold!`)
        break
      }

      case 'cassino': case 'apostar': {
        if (!isGrp) return reply('Apenas em grupos.')
        const betAmount = parseInt(text)
        if (!betAmount || betAmount <= 0) return reply(`Use: ${prefixUsed}cassino valor`)
        if (getGold(chatId, senderId) < betAmount) return reply('Saldo insuficiente!')
        const win = Math.random() < 0.45
        if (win) {
          const winAmount = betAmount * 2
          addGold(chatId, senderId, betAmount)
          await reply(`GANHOU! Voce ganhou ${winAmount} gold!`)
        } else {
          removeGold(chatId, senderId, betAmount)
          await reply(`PERDEU! Voce perdeu ${betAmount} gold.`)
        }
        break
      }

      case 'roletadasorte': {
        if (!isGrp) return reply('Apenas em grupos.')
        const betRoleta = parseInt(text)
        if (!betRoleta || betRoleta <= 0) return reply(`Use: ${prefixUsed}roletadasorte valor`)
        if (getGold(chatId, senderId) < betRoleta) return reply('Saldo insuficiente!')
        removeGold(chatId, senderId, betRoleta)
        const multiplier = pickRandom([0, 0, 0, 0.5, 1, 1.5, 2, 3, 5, 10])
        const winnings = Math.floor(betRoleta * multiplier)
        if (winnings > 0) addGold(chatId, senderId, winnings)
        await reply(`*Roleta da Sorte*\n\nMultiplicador: ${multiplier}x\n${winnings > 0 ? `Voce ganhou ${winnings} gold!` : 'Voce nao ganhou nada!'}`)
        break
      }

      case 'addgold': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!isOwner && !isAdmin) return reply('Sem permissao.')
        const targetAddGold = mentionedJid[0]
        const addGoldAmount = parseInt(args[args.length - 1])
        if (!targetAddGold || !addGoldAmount) return reply(`Use: ${prefixUsed}addgold @usuario valor`)
        addGold(chatId, targetAddGold, addGoldAmount)
        await replyMention(`${addGoldAmount} gold adicionado a @${formatPhone(targetAddGold)}`, [targetAddGold])
        break
      }

      case 'zerar_gold': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!isOwner && !isAdmin) return reply('Sem permissao.')
        const targetZero = mentionedJid[0]
        if (!targetZero) return reply(`Use: ${prefixUsed}zerar_gold @usuario`)
        setGold(chatId, targetZero, 0)
        await replyMention(`Gold de @${formatPhone(targetZero)} zerado.`, [targetZero])
        break
      }

      case 'sorteiogold': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!groupMetadata) return reply('Erro.')
        const winner = pickRandom(groupMetadata.participants.map(p => p.id))
        const prize = getRandom(100, 500)
        addGold(chatId, winner, prize)
        await replyMention(`*Sorteio de Gold!*\n\nGanhador: @${formatPhone(winner)}\nPremio: ${prize} gold!`, [winner])
        break
      }

      // ==================== ATIVIDADE / RANKINGS ====================
      case 'rankativos': case 'rankativo': {
        if (!isGrp) return reply('Apenas em grupos.')
        const actRanking = getActivityRanking(chatId, 15)
        if (actRanking.length === 0) return reply('Nenhum dado de atividade.')
        let actText = '*Ranking de Ativos:*\n\n'
        const actMentions = []
        actRanking.forEach(r => {
          actMentions.push(r.user)
          actText += `${r.pos}. @${formatPhone(r.user)} - ${r.messages} msgs\n`
        })
        await replyMention(actText, actMentions)
        break
      }

      case 'checkativo': {
        if (!isGrp) return reply('Apenas em grupos.')
        const targetCheck = mentionedJid[0] || quotedParticipant || senderId
        const actData = db.activity.get(`${chatId}_${targetCheck}`, { messages: 0, lastSeen: 0, stickers: 0 })
        await replyMention(`*Atividade de @${formatPhone(targetCheck)}:*\n\nMensagens: ${actData.messages}\nUltima vez ativo: ${actData.lastSeen ? formatDate(actData.lastSeen) : 'Nunca'}`, [targetCheck])
        break
      }

      // ==================== BRINCADEIRAS ====================
      case 'ppt': {
        if (!text) return reply(`Use: ${prefixUsed}ppt pedra/papel/tesoura`)
        const choices = ['pedra', 'papel', 'tesoura']
        const userChoice = text.toLowerCase()
        if (!choices.includes(userChoice)) return reply('Escolha: pedra, papel ou tesoura')
        const botChoice = pickRandom(choices)
        let result = ''
        if (userChoice === botChoice) result = 'Empate!'
        else if ((userChoice === 'pedra' && botChoice === 'tesoura') ||
                 (userChoice === 'papel' && botChoice === 'pedra') ||
                 (userChoice === 'tesoura' && botChoice === 'papel')) result = 'Voce ganhou!'
        else result = 'Voce perdeu!'
        await reply(`Voce: ${userChoice}\nBot: ${botChoice}\n\n*${result}*`)
        break
      }

      case 'roleta': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!groupMetadata) return reply('Erro.')
        const allParticipants = groupMetadata.participants.filter(p => !p.admin).map(p => p.id)
        if (allParticipants.length === 0) return reply('Nenhum membro disponivel.')
        const victim = pickRandom(allParticipants)
        await replyMention(`*Roleta Russa!*\n\n@${formatPhone(victim)} foi o sortudo(a) da vez!`, [victim])
        break
      }

      case 'sorteio': case 'sortear': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!groupMetadata) return reply('Erro.')
        const randomMember = pickRandom(groupMetadata.participants.map(p => p.id))
        await replyMention(`*Sorteio!*\n\nO sorteado foi: @${formatPhone(randomMember)}`, [randomMember])
        break
      }

      case 'chance': case 'porcentagem': {
        if (!text) return reply(`Use: ${prefixUsed}chance texto`)
        const pct = getRandom(0, 100)
        await reply(`*${text}*\n\nChance: ${pct}%`)
        break
      }

      case 'rankgay': {
        if (!isGrp || !groupMetadata) return reply('Apenas em grupos.')
        const gayMember = pickRandom(groupMetadata.participants.map(p => p.id))
        await replyMention(`*Rank Gay do grupo!*\n\nO mais gay do grupo e: @${formatPhone(gayMember)} com ${getRandom(50, 100)}%!`, [gayMember])
        break
      }

      case 'rankgado': {
        if (!isGrp || !groupMetadata) return reply('Apenas em grupos.')
        const gadoMember = pickRandom(groupMetadata.participants.map(p => p.id))
        await replyMention(`*Rank Gado do grupo!*\n\nO maior gado e: @${formatPhone(gadoMember)} com ${getRandom(50, 100)}%!`, [gadoMember])
        break
      }

      case 'rankcorno': {
        if (!isGrp || !groupMetadata) return reply('Apenas em grupos.')
        const cornoMember = pickRandom(groupMetadata.participants.map(p => p.id))
        await replyMention(`*Rank Corno do grupo!*\n\nO maior corno e: @${formatPhone(cornoMember)} com ${getRandom(50, 100)}%!`, [cornoMember])
        break
      }

      case 'rankgostoso': case 'rankgostosa': {
        if (!isGrp || !groupMetadata) return reply('Apenas em grupos.')
        const gostosoMember = pickRandom(groupMetadata.participants.map(p => p.id))
        await replyMention(`*Rank Gostoso(a) do grupo!*\n\nO(A) mais gostoso(a) e: @${formatPhone(gostosoMember)} com ${getRandom(70, 100)}%!`, [gostosoMember])
        break
      }

      case 'gadometro': {
        const pctGado = getRandom(0, 100)
        await reply(`*Gadometro*\n\nResultado: ${pctGado}%\n${'|'.repeat(Math.floor(pctGado / 5))}`)
        break
      }

      case 'corno': {
        const pctCorno = getRandom(0, 100)
        await reply(`*Cornometro*\n\nResultado: ${pctCorno}%\n${'|'.repeat(Math.floor(pctCorno / 5))}`)
        break
      }

      case 'casal': case 'ship': {
        if (!isGrp || !groupMetadata) return reply('Apenas em grupos.')
        const ps = groupMetadata.participants.map(p => p.id)
        const p1 = pickRandom(ps)
        let p2 = pickRandom(ps)
        while (p2 === p1 && ps.length > 1) p2 = pickRandom(ps)
        const shipPct = getRandom(10, 100)
        await replyMention(`*Casal do grupo!*\n\n@${formatPhone(p1)} + @${formatPhone(p2)}\nCompatibilidade: ${shipPct}%`, [p1, p2])
        break
      }

      case 'pergunta': {
        const questions = [
          'Qual sua comida favorita?', 'Se pudesse ter um superpoder, qual seria?',
          'Qual a coisa mais louca que ja fez?', 'Quem foi seu primeiro crush?',
          'Qual seu maior medo?', 'Qual sua musica favorita?',
          'Se ganhasse na loteria, o que faria primeiro?', 'Qual seu sonho de vida?',
          'Se fosse um animal, qual seria?', 'Qual a ultima coisa que te fez rir muito?'
        ]
        await reply(pickRandom(questions))
        break
      }

      case 'eujaeununca': case 'eu_ja_eu_nunca': {
        const phrases = [
          'Eu ja tomei um fora feio', 'Eu ja fingi que nao vi alguem na rua',
          'Eu ja ri em hora errada', 'Eu ja mandei mensagem para pessoa errada',
          'Eu ja cai em publico', 'Eu ja chorei por causa de filme',
          'Eu ja menti sobre minha idade', 'Eu ja stalkeei alguem nas redes',
          'Eu ja dormi no trabalho/escola', 'Eu ja fingi estar doente'
        ]
        await reply(`*Eu ja eu nunca...*\n\n${pickRandom(phrases)}`)
        break
      }

      case 'duelo': {
        if (!isGrp) return reply('Apenas em grupos.')
        const opponent = mentionedJid[0]
        if (!opponent) return reply(`Use: ${prefixUsed}duelo @usuario`)
        const senderPower = getRandom(1, 100)
        const opponentPower = getRandom(1, 100)
        const duelWinner = senderPower > opponentPower ? senderId : opponent
        await replyMention(`*DUELO!*\n\n@${formatPhone(senderId)}: ${senderPower} de poder\n@${formatPhone(opponent)}: ${opponentPower} de poder\n\nVencedor: @${formatPhone(duelWinner)}!`, [senderId, opponent])
        break
      }

      // ==================== AFK ====================
      case 'ausente': case 'afk': {
        db.afk.set(senderId, { reason: text || 'Sem motivo', since: Date.now() })
        await reply(`@${senderNumber} esta agora ausente.\nMotivo: ${text || 'Nao informado'}`)
        break
      }

      case 'ativo': {
        db.afk.delete(senderId)
        await reply('Voce saiu do modo ausente!')
        break
      }

      case 'listarafk': case 'statusafk': {
        const allAfk = db.afk.getAll()
        const afkEntries = Object.entries(allAfk)
        if (afkEntries.length === 0) return reply('Ninguem esta ausente.')
        let afkText = '*Membros ausentes:*\n\n'
        afkEntries.forEach(([id, data]) => {
          afkText += `@${formatPhone(id)} - ${data.reason} (desde ${formatDate(data.since)})\n`
        })
        await reply(afkText)
        break
      }

      // ==================== STICKERS ====================
      case 'sticker': case 's': case 'fig': case 'figurinha': {
        const mediaMsg = msg.message.imageMessage || msg.message.videoMessage ||
                         quotedMsg?.imageMessage || quotedMsg?.videoMessage
        if (!mediaMsg) return reply('Envie ou marque uma imagem/video com o comando!')
        try {
          const media = await downloadMediaMessage(msg)
          if (media) {
            await sock.sendMessage(chatId, {
              sticker: media,
              mimetype: 'image/webp',
              stickerMetadata: { 'sticker-pack-name': CONFIG.botName, 'sticker-pack-publisher': 'DEMI' }
            })
          }
        } catch (e) {
          await reply('Erro ao criar figurinha: ' + e.message)
        }
        break
      }

      case 'toimg': {
        if (!msg.message.stickerMessage && !quotedMsg?.stickerMessage) return reply('Marque uma figurinha!')
        try {
          const media = await downloadMediaMessage(msg)
          if (media) {
            const imgBuffer = await sharp(media).png().toBuffer()
            await sock.sendMessage(chatId, { image: imgBuffer, caption: 'Figurinha convertida!' })
          }
        } catch (e) {
          await reply('Erro: ' + e.message)
        }
        break
      }

      case 'ttp': {
        if (!text) return reply(`Use: ${prefixUsed}ttp texto`)
        try {
          const apiUrl = `https://api.lolhuman.xyz/api/ttp?apikey=free&text=${encodeURIComponent(text)}`
          const response = await axios.get(apiUrl, { responseType: 'arraybuffer' }).catch(() => null)
          if (response?.data) {
            await sock.sendMessage(chatId, {
              sticker: Buffer.from(response.data),
              mimetype: 'image/webp'
            })
          } else {
            await reply('Erro ao gerar figurinha de texto. Tente novamente.')
          }
        } catch {
          await reply('Servico de TTP indisponivel.')
        }
        break
      }

      case 'take': case 'rename': {
        if (!msg.message.stickerMessage && !quotedMsg?.stickerMessage) return reply('Marque uma figurinha!')
        const parts = text.split('|').map(s => s.trim())
        const packName = parts[0] || CONFIG.botName
        const authorName = parts[1] || senderNumber
        try {
          const media = await downloadMediaMessage(msg)
          if (media) {
            await sock.sendMessage(chatId, {
              sticker: media,
              mimetype: 'image/webp',
              stickerMetadata: { 'sticker-pack-name': packName, 'sticker-pack-publisher': authorName }
            })
          }
        } catch (e) {
          await reply('Erro: ' + e.message)
        }
        break
      }

      // ==================== DOWNLOADS ====================
      case 'play': case 'play_audio': {
        if (!text) return reply(`Use: ${prefixUsed}play nome da musica ou URL`)
        await reply('Buscando audio... Aguarde!')
        try {
          const searchUrl = `https://api.lolhuman.xyz/api/ytsearch?apikey=free&query=${encodeURIComponent(text)}`
          const search = await axios.get(searchUrl).catch(() => null)
          if (search?.data?.result?.[0]) {
            const videoUrl = search.data.result[0].url
            const audioUrl = `https://api.lolhuman.xyz/api/ytaudio?apikey=free&url=${encodeURIComponent(videoUrl)}`
            const audio = await axios.get(audioUrl, { responseType: 'arraybuffer' }).catch(() => null)
            if (audio?.data) {
              await sock.sendMessage(chatId, {
                audio: Buffer.from(audio.data),
                mimetype: 'audio/mp4',
                ptt: false
              }, { quoted: msg })
            } else {
              await reply('Erro ao baixar o audio.')
            }
          } else {
            await reply('Nenhum resultado encontrado.')
          }
        } catch {
          await reply('Servico de download indisponivel.')
        }
        break
      }

      case 'ytsearch': case 'ytbuscar': {
        if (!text) return reply(`Use: ${prefixUsed}ytsearch texto`)
        try {
          const searchUrl = `https://api.lolhuman.xyz/api/ytsearch?apikey=free&query=${encodeURIComponent(text)}`
          const search = await axios.get(searchUrl).catch(() => null)
          if (search?.data?.result) {
            let results = '*Resultados do YouTube:*\n\n'
            search.data.result.slice(0, 5).forEach((r, i) => {
              results += `${i + 1}. ${r.title}\n   ${r.url}\n   Duracao: ${r.duration}\n\n`
            })
            await reply(results)
          } else {
            await reply('Nenhum resultado.')
          }
        } catch {
          await reply('Erro na busca.')
        }
        break
      }

      case 'letra': case 'lyrics': {
        if (!text) return reply(`Use: ${prefixUsed}letra nome da musica`)
        try {
          const lyricsUrl = `https://api.lolhuman.xyz/api/lirik?apikey=free&query=${encodeURIComponent(text)}`
          const response = await axios.get(lyricsUrl).catch(() => null)
          if (response?.data?.result) {
            await reply(`*Letra: ${text}*\n\n${response.data.result}`)
          } else {
            await reply('Letra nao encontrada.')
          }
        } catch {
          await reply('Servico indisponivel.')
        }
        break
      }

      case 'pinterest': {
        if (!text) return reply(`Use: ${prefixUsed}pinterest texto`)
        try {
          const pinterestUrl = `https://api.lolhuman.xyz/api/pinterest?apikey=free&query=${encodeURIComponent(text)}`
          const response = await axios.get(pinterestUrl).catch(() => null)
          if (response?.data?.result) {
            const images = Array.isArray(response.data.result) ? response.data.result : [response.data.result]
            for (const img of images.slice(0, 3)) {
              await sock.sendMessage(chatId, { image: { url: img }, caption: `Pinterest: ${text}` }).catch(() => {})
            }
          } else {
            await reply('Nenhuma imagem encontrada.')
          }
        } catch {
          await reply('Servico indisponivel.')
        }
        break
      }

      // ==================== UTILIDADES ====================
      case 'traduzir': {
        if (!text) return reply(`Use: ${prefixUsed}traduzir idioma texto\nExemplo: ${prefixUsed}traduzir en Ola mundo`)
        const [lang, ...translateText] = args
        const textToTranslate = translateText.join(' ')
        if (!textToTranslate) return reply(`Use: ${prefixUsed}traduzir idioma texto`)
        try {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=pt|${lang}`
          const res = await axios.get(url)
          if (res.data?.responseData?.translatedText) {
            await reply(`*Traducao (${lang}):*\n\n${res.data.responseData.translatedText}`)
          } else {
            await reply('Erro na traducao.')
          }
        } catch {
          await reply('Servico de traducao indisponivel.')
        }
        break
      }

      case 'clima': case 'weather': {
        if (!text) return reply(`Use: ${prefixUsed}clima cidade`)
        try {
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(text)}&appid=demo&units=metric&lang=pt_br`
          const res = await axios.get(weatherUrl).catch(() => null)
          if (res?.data) {
            const w = res.data
            await reply(`*Clima em ${w.name}:*\n\nTemperatura: ${w.main.temp}C\nSensacao: ${w.main.feels_like}C\nUmidade: ${w.main.humidity}%\nCondicao: ${w.weather[0].description}`)
          } else {
            await reply('Cidade nao encontrada.')
          }
        } catch {
          await reply('Servico de clima indisponivel.')
        }
        break
      }

      case 'calculadora': case 'calcular': {
        if (!text) return reply(`Use: ${prefixUsed}calculadora expressao`)
        try {
          const sanitized = text.replace(/[^0-9+\-*/().%\s]/g, '')
          const calcResult = Function(`"use strict"; return (${sanitized})`)()
          await reply(`*Calculadora:*\n${text} = ${calcResult}`)
        } catch {
          await reply('Expressao invalida!')
        }
        break
      }

      case 'sorte': case 'signo': {
        const signs = {
          aries: 'Aries', touro: 'Touro', gemeos: 'Gemeos', cancer: 'Cancer',
          leao: 'Leao', virgem: 'Virgem', libra: 'Libra', escorpiao: 'Escorpiao',
          sagitario: 'Sagitario', capricornio: 'Capricornio', aquario: 'Aquario', peixes: 'Peixes'
        }
        const luck = ['Muito boa', 'Boa', 'Regular', 'Otima', 'Excelente']
        if (!text) return reply(`Use: ${prefixUsed}signo nome\nSignos: ${Object.values(signs).join(', ')}`)
        const sign = signs[text.toLowerCase()]
        if (!sign) return reply('Signo invalido!')
        await reply(`*${sign}*\n\nSorte de hoje: ${pickRandom(luck)}\nNumero da sorte: ${getRandom(1, 99)}\nCor da sorte: ${pickRandom(['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo'])}`)
        break
      }

      case 'moedas': {
        try {
          const res = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL').catch(() => null)
          if (res?.data) {
            let cotacao = '*Cotacoes:*\n\n'
            for (const [key, val] of Object.entries(res.data)) {
              cotacao += `${val.name}: R$ ${parseFloat(val.bid).toFixed(2)}\n`
            }
            await reply(cotacao)
          } else {
            await reply('Erro ao buscar cotacoes.')
          }
        } catch {
          await reply('Servico indisponivel.')
        }
        break
      }

      case 'encurtalink': {
        if (!text) return reply(`Use: ${prefixUsed}encurtalink URL`)
        try {
          const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`)
          await reply(`*Link encurtado:*\n${res.data}`)
        } catch {
          await reply('Erro ao encurtar link.')
        }
        break
      }

      case 'wame': {
        const targetWame = mentionedJid[0] || quotedParticipant
        if (targetWame) {
          await reply(`wa.me/${formatPhone(targetWame)}`)
        } else if (text) {
          await reply(`wa.me/${text.replace(/[^0-9]/g, '')}`)
        } else {
          await reply(`wa.me/${senderNumber}`)
        }
        break
      }

      case 'perfil': case 'me': {
        const targetProfile = mentionedJid[0] || quotedParticipant || senderId
        const goldP = isGrp ? getGold(chatId, targetProfile) : 0
        const actP = isGrp ? db.activity.get(`${chatId}_${targetProfile}`, { messages: 0 }) : { messages: 0 }
        const warnP = isGrp ? getWarnings(chatId, targetProfile) : []
        const roleP = isGrp ? getUserRole(chatId, targetProfile) : 'N/A'
        let ppUrlP = null
        try { ppUrlP = await sock.profilePictureUrl(targetProfile, 'image') } catch {}

        const profileText = `*Perfil de @${formatPhone(targetProfile)}*\n\nCargo: ${roleP}\nGold: ${goldP}\nMensagens: ${actP.messages}\nAdvertencias: ${warnP.length}\nNumero: ${formatPhone(targetProfile)}`

        if (ppUrlP) {
          await sock.sendMessage(chatId, { image: { url: ppUrlP }, caption: profileText, mentions: [targetProfile] })
        } else {
          await replyMention(profileText, [targetProfile])
        }
        break
      }

      case 'sn': {
        if (!text) return reply(`Use: ${prefixUsed}sn pergunta`)
        const answer = pickRandom(['Sim', 'Nao', 'Talvez', 'Com certeza', 'De jeito nenhum', 'Provavel', 'Improvavel', 'Definitivamente sim', 'Acho que nao'])
        await reply(`*Pergunta:* ${text}\n*Resposta:* ${answer}`)
        break
      }

      case 'eco': case 'repeat': case 'repetir': {
        if (!text) return reply(`Use: ${prefixUsed}eco texto`)
        await sock.sendMessage(chatId, { text: text })
        break
      }

      case 'simi': case 'bot': {
        if (!text) return reply('Diga algo para eu responder!')
        const responses = [
          'Interessante! Conte mais.',
          'Hmm, sera mesmo?',
          'Concordo totalmente!',
          'Nao sei se concordo...',
          'Isso e incrivel!',
          'Que legal!',
          'Serio? Nao sabia disso.',
          'Voce e muito sabio(a)!',
          'Hahaha, boa essa!',
          'Entendi, mas discordo.',
          'Pode ser... Quem sabe?',
          'Uau, nunca pensei nisso!',
        ]
        await reply(pickRandom(responses))
        break
      }

      // ==================== DELETAR MENSAGEM ====================
      case 'deletar': case 'del': case 'apagar': {
        if (!hasPermission(chatId, senderId, ROLES.AUX) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        if (!quotedMsg) return reply('Marque a mensagem que deseja apagar.')
        const quotedKey = {
          remoteJid: chatId,
          fromMe: false,
          id: contextInfo.stanzaId,
          participant: quotedParticipant
        }
        await sock.sendMessage(chatId, { delete: quotedKey }).catch(() => {})
        await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {})
        break
      }

      // ==================== ACEITAR MEMBROS ====================
      case 'aceitar': case 'aceitarmembro': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.MOD) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        try {
          const pendingRequests = await sock.groupRequestParticipantsList(chatId).catch(() => [])
          if (pendingRequests.length === 0) return reply('Nenhuma solicitacao pendente.')
          for (const req of pendingRequests) {
            await sock.groupRequestParticipantsUpdate(chatId, [req.jid], 'approve').catch(() => {})
          }
          await reply(`${pendingRequests.length} solicitacoes aceitas!`)
        } catch {
          await reply('Erro ao aceitar solicitacoes.')
        }
        break
      }

      // ==================== BANIR FAKES ====================
      case 'banfakes': case 'banfake': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        if (!isBotAdmin) return reply('O bot precisa ser admin.')
        if (!groupMetadata) return reply('Erro.')
        let fakeCount = 0
        for (const p of groupMetadata.participants) {
          if (p.admin) continue
          if (!p.id.startsWith('55')) {
            await sock.groupParticipantsUpdate(chatId, [p.id], 'remove').catch(() => {})
            fakeCount++
            await sleep(1000)
          }
        }
        await reply(`${fakeCount} numeros fakes/estrangeiros removidos.`)
        break
      }

      // ==================== PREFIXOS ====================
      case 'prefixos': case 'prefix': {
        const gConfig = getGroupConfig(chatId)
        await reply(`*Prefixos do grupo:*\n\nPrefixo principal: ${gConfig.prefix}\nMulti-prefixo: ${gConfig.multiprefix ? 'ATIVO' : 'INATIVO'}\nPrefixos aceitos: ${CONFIG.prefix.join(', ')}`)
        break
      }

      // ==================== LIMITE DE CARACTERES ====================
      case 'limitexto': case 'limitecaracteres': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const limitVal = parseInt(text) || 0
        setGroupConfig(chatId, 'limitexto', limitVal)
        await reply(limitVal > 0 ? `Limite de texto definido: ${limitVal} caracteres` : 'Limite de texto removido.')
        break
      }

      // ==================== SETMAXWARN ====================
      case 'setmaxwarn': case 'setlimitec': {
        if (!isGrp) return reply('Apenas em grupos.')
        if (!hasPermission(chatId, senderId, ROLES.ADMIN) && !isAdmin) return reply('Sem permissao.')
        const maxWarnVal = parseInt(text) || 3
        setGroupConfig(chatId, 'maxWarnings', maxWarnVal)
        await reply(`Maximo de advertencias definido: ${maxWarnVal}`)
        break
      }

      // ==================== RANKING ATIVOS GLOBAL ====================
      case 'rankativosg': {
        if (!isGrp) return reply('Apenas em grupos.')
        const allAct = db.activity.getAll()
        const globalAct = {}
        for (const [key, val] of Object.entries(allAct)) {
          const userId = key.split('_').pop()
          if (!globalAct[userId]) globalAct[userId] = 0
          globalAct[userId] += val.messages
        }
        const sorted = Object.entries(globalAct).sort((a, b) => b[1] - a[1]).slice(0, 15)
        let gText = '*Ranking Global de Ativos:*\n\n'
        sorted.forEach(([user, msgs], i) => { gText += `${i + 1}. ${formatPhone(user)} - ${msgs} msgs\n` })
        await reply(gText)
        break
      }

      // ==================== IMAGEM EFEITOS ====================
      case 'blur': case 'greyscale': case 'sepia': case 'invert': case 'circulo': {
        const imgMsg = msg.message.imageMessage || quotedMsg?.imageMessage
        if (!imgMsg) return reply('Envie ou marque uma imagem!')
        try {
          const media = await downloadMediaMessage(msg)
          if (!media) return reply('Erro ao baixar imagem.')
          let processed
          switch (command) {
            case 'blur': processed = await sharp(media).blur(10).toBuffer(); break
            case 'greyscale': processed = await sharp(media).greyscale().toBuffer(); break
            case 'sepia': processed = await sharp(media).tint({ r: 112, g: 66, b: 20 }).toBuffer(); break
            case 'invert': processed = await sharp(media).negate().toBuffer(); break
            case 'circulo': {
              const imgMeta = await sharp(media).metadata()
              const size = Math.min(imgMeta.width, imgMeta.height)
              const roundedCorners = Buffer.from(
                `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`
              )
              processed = await sharp(media).resize(size, size).composite([{
                input: roundedCorners, blend: 'dest-in'
              }]).png().toBuffer()
              break
            }
          }
          await sock.sendMessage(chatId, { image: processed, caption: `Efeito: ${command}` })
        } catch (e) {
          await reply('Erro: ' + e.message)
        }
        break
      }

      // ==================== COMANDO DESCONHECIDO ====================
      default: {
        break
      }
    }
  } catch (err) {
    console.error(`[DEMI BOT] Erro no comando ${command}:`, err.message)
    await reply('Ocorreu um erro ao processar o comando.').catch(() => {})
  }
}

// ============================================
// API EXPRESS PARA O PAINEL
// ============================================
const app = express()
app.use(cors())
app.use(express.json())

// Auth middleware simples
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token === CONFIG.panelPassword) return next()
  res.status(401).json({ error: 'Nao autorizado' })
}

// Login endpoint (para o painel)
app.post('/api/login', (req, res) => {
  const { password } = req.body
  if (password === CONFIG.panelPassword) {
    res.json({ success: true, token: CONFIG.panelPassword })
  } else {
    res.status(401).json({ error: 'Senha incorreta' })
  }
})

// Status do bot
app.get('/api/bot/status', authMiddleware, (req, res) => {
  res.json({
    connected: !!sock?.user,
    botName: CONFIG.botName,
    botNumber: sock?.user?.id ? formatPhone(sock.user.id) : null,
    uptime: Date.now() - botStartTime,
    stats: db.stats.get('global', {}),
    totalGroups: Object.keys(db.rental.getAll()).length,
  })
})

// Listar grupos
app.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    const groups = await sock?.groupFetchAllParticipating().catch(() => ({}))
    const list = Object.values(groups || {}).map(g => ({
      id: g.id,
      name: g.subject,
      members: g.participants?.length || 0,
      rental: getRentalInfo(g.id),
      config: getGroupConfig(g.id),
    }))
    res.json(list)
  } catch {
    res.json([])
  }
})

// Configuracao de um grupo
app.get('/api/groups/:id/config', authMiddleware, (req, res) => {
  res.json(getGroupConfig(req.params.id))
})

app.put('/api/groups/:id/config', authMiddleware, (req, res) => {
  const { key, value } = req.body
  setGroupConfig(req.params.id, key, value)
  res.json({ success: true })
})

// Ativar aluguel
app.post('/api/groups/:id/rental', authMiddleware, (req, res) => {
  const { duration } = req.body
  const expireAt = activateRental(req.params.id, duration, 'panel')
  if (!expireAt) return res.status(400).json({ error: 'Duracao invalida' })
  res.json({ success: true, expireAt })
})

// Desativar aluguel
app.delete('/api/groups/:id/rental', authMiddleware, (req, res) => {
  const rental = db.rental.get(req.params.id)
  if (rental) {
    rental.active = false
    db.rental.set(req.params.id, rental)
  }
  res.json({ success: true })
})

// Lista negra
app.get('/api/blacklist', authMiddleware, (req, res) => {
  res.json(db.blacklist.getAll())
})

app.post('/api/blacklist', authMiddleware, (req, res) => {
  const { number, reason } = req.body
  addToBlacklist(number, reason, 'panel')
  res.json({ success: true })
})

app.delete('/api/blacklist/:number', authMiddleware, (req, res) => {
  removeFromBlacklist(req.params.number)
  res.json({ success: true })
})

// Advertencias de um grupo
app.get('/api/groups/:id/warnings', authMiddleware, (req, res) => {
  const allWarns = db.warnings.getAll()
  const groupWarns = {}
  for (const [key, val] of Object.entries(allWarns)) {
    if (key.startsWith(req.params.id)) {
      const userId = key.replace(req.params.id + '_', '')
      groupWarns[userId] = val
    }
  }
  res.json(groupWarns)
})

// Alugueis
app.get('/api/rentals', authMiddleware, (req, res) => {
  const allRentals = db.rental.getAll()
  const enriched = {}
  for (const [gid, data] of Object.entries(allRentals)) {
    enriched[gid] = { ...data, remaining: timeRemaining(data.expireAt), isExpired: Date.now() > data.expireAt }
  }
  res.json(enriched)
})

// Stats
app.get('/api/stats', authMiddleware, (req, res) => {
  res.json(db.stats.get('global', {}))
})

// Enviar mensagem
app.post('/api/send', authMiddleware, async (req, res) => {
  const { groupId, message } = req.body
  try {
    await sock.sendMessage(groupId, { text: message })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Broadcast
app.post('/api/broadcast', authMiddleware, async (req, res) => {
  const { message } = req.body
  const allRentals = db.rental.getAll()
  let count = 0
  for (const [gid, rental] of Object.entries(allRentals)) {
    if (rental.active) {
      await sock.sendMessage(gid, { text: `*[BROADCAST]*\n\n${message}` }).catch(() => {})
      count++
    }
  }
  res.json({ success: true, groupsSent: count })
})

// Iniciar API
app.listen(CONFIG.apiPort, '0.0.0.0', () => {
  console.log(`[DEMI BOT] API rodando na porta ${CONFIG.apiPort}`)
})

// ============================================
// INICIAR BOT
// ============================================
console.log('============================================')
console.log('  DEMI BOT - WhatsApp Group Bot')
console.log('  Dono: +5592999652961')
console.log('  Painel: http://129.121.38.161:3000')
console.log('  API: http://129.121.38.161:5001')
console.log('============================================')
startBot()
