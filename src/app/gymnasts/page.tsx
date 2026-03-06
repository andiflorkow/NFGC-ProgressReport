'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Badge } from '../../components/ui/badge'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { Gymnast, GymStatus } from '../../types/models'

const uid = () => Math.random().toString(36).slice(2, 11)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GYM_LEVEL_OPTIONS = [
  'Xcel Bronze',
  'Xcel Silver',
  'Xcel Gold',
  'Xcel Platinum',
  'Xcel Diamond',
  'Xcel Sapphire',
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Level 9',
  'Level 10',
] as const

export default function GymnastsPage() {
  const { open, setOpen, message, toast } = useToast()
  const { data, save, loading } = useAppData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'All' | GymStatus>('All')
  const [level, setLevel] = useState('All')
  const [selectedGymnastId, setSelectedGymnastId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const [name, setName] = useState('')
  const [gymLevel, setGymLevel] = useState<string>(GYM_LEVEL_OPTIONS[0])
  const [gymStatus, setGymStatus] = useState<GymStatus>('Active')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [notes, setNotes] = useState('')

  const levels = useMemo(() => {
    if (!data) return [] as string[]
    return Array.from(new Set(data.gymnasts.map((item) => item.level)))
  }, [data])

  const filtered = useMemo(
    () => {
      if (!data) return [] as Gymnast[]
      return (
      data.gymnasts.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
        const matchesStatus = status === 'All' || item.status === status
        const matchesLevel = level === 'All' || item.level === level
        return matchesSearch && matchesStatus && matchesLevel
      })
      )
    },
    [data, search, status, level],
  )

  const selected = useMemo(() => {
    if (!data) return undefined
    return data.gymnasts.find((item) => item.id === (selectedGymnastId || filtered[0]?.id))
  }, [data, selectedGymnastId, filtered])

  if (loading || !data) return <p>Loading...</p>

  const addGymnast = async () => {
    if (!name.trim()) return toast('Gymnast name is required')
    if (!gymLevel.trim()) return toast('Level is required')
    if (!guardianEmail.trim() || !emailPattern.test(guardianEmail)) return toast('At least one valid guardian email is required')

    const gymnast: Gymnast = {
      id: uid(),
      name: name.trim(),
      level: gymLevel,
      status: gymStatus,
      guardians: [{ id: uid(), email: guardianEmail.trim(), name: guardianName || undefined, phone: guardianPhone || undefined }],
      notes,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: data.coachName,
    }

    await save({ ...data, gymnasts: [gymnast, ...data.gymnasts] })
    setSelectedGymnastId(gymnast.id)
    setModalOpen(false)
    setName('')
    setGymLevel(GYM_LEVEL_OPTIONS[0])
    setGymStatus('Active')
    setGuardianEmail('')
    setGuardianName('')
    setGuardianPhone('')
    setNotes('')
    setShowMore(false)
    toast('Gymnast added')
  }

  const deleteGymnast = async () => {
    if (!selected) return
    const next = {
      ...data,
      gymnasts: data.gymnasts.filter((item) => item.id !== selected.id),
      reports: data.reports.filter((report) => report.gymnastId !== selected.id),
    }
    await save(next)
    setDeleteConfirmOpen(false)
    setSelectedGymnastId('')
    toast('Gymnast deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Gymnasts</h2>
          <p className="text-sm text-muted">Primary task: select a gymnast and open profile/report actions.</p>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button>Add Gymnast</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Gymnast</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm">Gymnast Name <span className="text-primary">* Required</span></p>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Ava Smith" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm">Level <span className="text-primary">* Required</span></p>
                  <Select value={gymLevel} onValueChange={setGymLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GYM_LEVEL_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-sm">Status <span className="text-primary">* Required</span></p>
                  <Select value={gymStatus} onValueChange={(value) => setGymStatus(value as GymStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm">Guardian Email <span className="text-primary">* Required</span></p>
                <Input value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} placeholder="parent@email.com" />
              </div>

              <button className="text-sm text-primary" onClick={() => setShowMore((prev) => !prev)}>
                {showMore ? 'Hide additional details' : 'Add more details'}
              </button>

              {showMore ? (
                <div className="space-y-3 rounded-xl border border-border bg-bg p-3">
                  <Input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="Guardian name (optional)" />
                  <Input value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} placeholder="Guardian phone (optional)" />
                  <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes (optional)" />
                </div>
              ) : null}
              <Button className="w-full" onClick={() => void addGymnast()}>Create Gymnast</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Gymnast List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search gymnast" />
              <Select value={status} onValueChange={(value) => setStatus(value as 'All' | GymStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Levels</SelectItem>
                  {levels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filtered.map((item) => (
                <button key={item.id} onClick={() => setSelectedGymnastId(item.id)} className="w-full rounded-xl border border-border bg-bg p-3 text-left hover:bg-black/5">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{item.name}</p>
                    <Badge variant={item.status === 'Active' ? 'success' : 'warning'}>{item.status}</Badge>
                  </div>
                  <p className="text-sm text-muted">Level {item.level}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? <p className="text-sm text-muted">Select a gymnast to view details.</p> : (
              <>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-sm text-muted">Level {selected.level} • {selected.status}</p>
                  <p className="mt-1 text-sm text-muted">Last updated by {selected.lastUpdatedBy} on {new Date(selected.lastUpdatedAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="mb-1 text-sm font-medium">Guardian Emails</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.guardians.map((guardian) => <Badge key={guardian.id} variant="secondary">{guardian.email}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/gymnasts/${selected.id}`} className="flex-1"><Button className="w-full">Open Profile</Button></Link>
                  <Link href={`/reports?gymnastId=${selected.id}`} className="flex-1"><Button variant="secondary" className="w-full">Build Report</Button></Link>
                </div>
                <Button variant="destructive" className="w-full" onClick={() => setDeleteConfirmOpen(true)}>Delete Gymnast</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete gymnast?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted">This removes the gymnast profile and all associated reports. This cannot be undone.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteGymnast()}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
