import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(subjects)
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const { code, name, year, term } = req.body
  try {
    const subject = await prisma.subject.create({
      data: { code, name, year, term, userId: req.userId },
    })
    res.json(subject)
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  const { code, name, year, term } = req.body
  try {
    const subject = await prisma.subject.update({
      where: { id: String(req.params.id) },
      data: { code, name, year, term },
    })
    res.json(subject)
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.subject.delete({
      where: { id: String(req.params.id) },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

export default router
