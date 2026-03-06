'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, ClipboardCheck, ShieldAlert, Mail, Settings, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { COACH_SESSION_KEY } from '../lib/coach-session'
import { applyTheme, readThemeMode } from '../lib/theme'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gymnasts', label: 'Gymnasts', icon: Users },
  { href: '/reports', label: 'Report Builder', icon: ClipboardCheck },
  { href: '/needs', label: 'Needs Updating', icon: ShieldAlert },
  { href: '/review', label: 'Email Review', icon: Mail },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [currentCoach, setCurrentCoach] = useState('')

  useEffect(() => {
    const storedCoach = localStorage.getItem(COACH_SESSION_KEY)?.trim() || ''
    setCurrentCoach(storedCoach)

    if (!storedCoach && pathname !== '/') {
      router.replace('/')
      setSessionReady(true)
      return
    }

    if (storedCoach && pathname === '/login') {
      router.replace('/dashboard')
      setSessionReady(true)
      return
    }

    setSessionReady(true)
  }, [pathname, router])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => applyTheme(readThemeMode())

    syncTheme()
    media.addEventListener('change', syncTheme)
    window.addEventListener('storage', syncTheme)

    return () => {
      media.removeEventListener('change', syncTheme)
      window.removeEventListener('storage', syncTheme)
    }
  }, [])

  if (pathname === '/' || pathname === '/login') {
    return <div className="min-h-screen bg-bg">{children}</div>
  }

  if (!sessionReady) {
    return <div className="min-h-screen bg-bg p-6">Loading...</div>
  }

  const handleSwitchCoach = () => {
    localStorage.removeItem(COACH_SESSION_KEY)
    setCurrentCoach('')
    setOpen(false)
    router.push('/')
  }

  const navContent = (
    <nav className="space-y-1 p-2">
      {nav.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/5 hover:text-text',
              active && 'bg-black/5 text-text',
            )}
          >
            {active ? <span className="absolute left-0 top-2 h-6 w-1 rounded-r bg-primary" /> : null}
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[1300px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <img src="/images/nfgc-logo.png" alt="NFGC" className="h-10 w-auto max-w-[120px] object-contain" />
            <Link href="/dashboard" className="text-[26px] font-semibold">NFGC Family Reports</Link>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <p className="text-sm text-muted">Signed in: {currentCoach || 'Coach'}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSwitchCoach}
            >
              Switch Coach
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1300px] grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-border bg-surface md:block">{navContent}</aside>
        <main className="p-4 md:p-6">{children}</main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-surface" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="font-medium">Navigation</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {navContent}
            <div className="border-t border-border p-3">
              <p className="mb-2 text-sm text-muted">Signed in: {currentCoach || 'Coach'}</p>
              <Button className="w-full" variant="secondary" onClick={handleSwitchCoach}>
                Switch Coach
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
