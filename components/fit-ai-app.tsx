'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  ArrowUp,
  ChevronDown,
  FolderKanban,
  Home,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'

const services = ['Fluig', 'Protheus', 'Service Desk', 'Marketing', 'Comercial', 'DHO', 'COT', 'Diretoria']

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type CurrentUser = { id: string; email: string; name?: string; role: string }

function welcomeMessage(email: string): ChatMessage[] {
  const firstName = email.split('@')[0]?.split('.')[0] || 'time'
  return [
    {
      role: 'assistant',
      content: `Olá, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}! Sou a **FIT AI**, como posso te ajudar hoje?\n\nPosso apoiar você com processos, documentos, análises e dúvidas dos departamentos.`,
    },
  ]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          return match ? (
            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="!my-3 !rounded-xl !bg-[#111923] !p-4 text-[13px]" {...props}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-cyan-300" {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function FitAiApp() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [email, setEmail] = useState('felipe.stamboni@fitgestao.com')
  const [password, setPassword] = useState('')
  const [activeService, setActiveService] = useState('Fluig')
  const [expanded, setExpanded] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[] | null>(null)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data) => {
        if (active && data.user) {
          setCurrentUser(data.user)
          setEmail(data.user.email)
          setLoggedIn(true)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const sessionId = useMemo(
    () => (email ? `${email}-${activeService}` : `guest-${activeService}`),
    [email, activeService],
  )

  const { data: history, isLoading } = useSWR<{ messages?: ChatMessage[]; error?: string }>(
    loggedIn ? `/api/chat?session_id=${encodeURIComponent(sessionId)}&collection_name=chat_messages` : null,
    fetcher,
  )

  useEffect(() => {
    setLocalMessages(null)
  }, [sessionId])

  const messages: ChatMessage[] = localMessages
    ?? (history?.messages && history.messages.length > 0 ? history.messages : welcomeMessage(email))

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles size={21} />
            </div>
            <span className="text-xl font-semibold tracking-tight">FIT AI</span>
          </div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight">Entre na sua conta</h1>
          <p className="mb-9 text-sm leading-6 text-muted-foreground">Acesse seus agentes e continue sua jornada de produtividade.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setLoginError('')
              setLoginLoading(true)
              try {
                const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.')
                setCurrentUser(data.user)
                setLoggedIn(true)
                setPassword('')
              } catch (error) {
                setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar.')
              } finally {
                setLoginLoading(false)
              }
            }}
            className="space-y-5"
          >
            <label className="block text-sm font-medium">
              E-mail
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                className="mt-2 h-12 w-full rounded-xl border bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block text-sm font-medium">
              Senha
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 h-12 w-full rounded-xl border bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            {loginError ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{loginError}</p> : null}
            <button disabled={loginLoading} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              Entrar
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-muted-foreground">Acesso seguro para sua equipe</p>
        </div>
      </main>
    )
  }

  const submit = async () => {
    const text = input.trim()
    if (!text || sending) return

    const base = localMessages ?? messages
    setLocalMessages([...base, { role: 'user', content: text }])
    setInput('')
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          agent_type: activeService,
          user_message: text,
          user_email: email,
          user_id: currentUser?.id ?? '',
          collection_name: 'chat_messages',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Erro ${response.status} ao enviar mensagem.`)
      setLocalMessages((current) => [
        ...(current ?? []),
        { role: 'assistant', content: data.message || 'Recebi sua mensagem. Como posso continuar ajudando?' },
      ])
    } catch {
      setLocalMessages((current) => [
        ...(current ?? []),
        { role: 'assistant', content: 'Não foi possível conectar ao agente agora. Tente novamente em instantes.' },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <aside
        className={`${mobileSidebar ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 flex w-[280px] min-h-0 flex-col overflow-y-auto border-r bg-sidebar p-5 transition-transform md:static md:translate-x-0`}
      >
        <div className="mb-9 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles size={17} />
            </div>
            <span className="font-semibold tracking-tight">FIT AI</span>
          </div>
          <button className="md:hidden" onClick={() => setMobileSidebar(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <button
          onClick={() => setLocalMessages(welcomeMessage(email))}
          className="mb-7 flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 text-sm font-medium transition hover:border-primary hover:text-primary"
        >
          <Plus size={17} /> Nova conversa
        </button>

        <nav className="space-y-1">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
          {[
            ['Home', Home],
            ['Projetos', FolderKanban],
            ['Chats', MessageSquare],
          ].map(([name, Icon]) => {
            const IconComponent = Icon as typeof Home
            return (
              <button
                key={name as string}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  name === 'Chats' ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                <IconComponent size={17} />
                {name as string}
              </button>
            )
          })}
        </nav>

        <div className="mt-8">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between px-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span>Área de Serviços</span>
            <ChevronDown size={14} className={expanded ? '' : '-rotate-90'} />
          </button>
          {expanded && (
            <div className="mt-3 space-y-0.5">
              {services.map((service) => (
                <button
                  key={service}
                  onClick={() => {
                    setActiveService(service)
                    setMobileSidebar(false)
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm ${
                    service === activeService ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3 border-t pt-5">
          {currentUser?.role === 'admin' ? (
            <Link href="/admin" className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20">
              Gerenciar plataforma
            </Link>
          ) : null}
          <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-medium">
            {email.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{email || 'Usuário'}</p>
            <p className="truncate text-xs text-muted-foreground">{currentUser?.role === 'admin' ? 'Administrador' : 'Equipe FIT'}</p>
          </div>
          </div>
        </div>
      </aside>

      {mobileSidebar && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMobileSidebar(false)}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
        />
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)} aria-label="Abrir menu">
              <MessageSquare size={20} />
            </button>
            <div>
              <h2 className="text-sm font-semibold">{activeService}</h2>
              <p className="text-xs text-muted-foreground">Agente especializado</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
          {isLoading && !localMessages ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`mx-auto flex w-full max-w-3xl items-start gap-3 py-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles size={15} />
                  </div>
                )}
                <div
                  className={`${message.role === 'user' ? 'max-w-[min(42rem,82%)] rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm' : 'min-w-0 max-w-3xl flex-1 px-1 py-1'} text-[15px] leading-7`}
                >
                  <MarkdownMessage content={message.content} />
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles size={15} />
              </div>
              <div className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">Digitando...</div>
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="shrink-0 border-t bg-background/95 p-4 backdrop-blur"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border bg-card px-4 py-2 shadow-sm">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Pergunte algo para ${activeService}...`}
              className="h-11 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Enviar mensagem"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
