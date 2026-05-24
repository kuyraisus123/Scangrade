import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/students?subjectId=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.query
    const where: any = {}
    if (subjectId) where.subjectId = String(subjectId)

    const students = await prisma.student.findMany({
      where,
      include: {
        subject: { select: { name: true, code: true } },
        sheets:  { select: { score: true, createdAt: true } },
      },
      orderBy: { studentId: 'asc' },
    })
    res.json(students)
  } catch (err) {
    console.error('GET students error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

// POST /api/students
router.post('/', async (req: Request, res: Response) => {
  const { studentId, name, subjectId } = req.body
  console.log('POST /api/students body:', { studentId, name, subjectId })
  try {
    const existing = await prisma.student.findFirst({
      where: { studentId, subjectId },
    })
    if (existing) {
      res.status(400).json({ error: 'รหัสนักศึกษานี้มีในวิชานี้แล้ว' })
      return
    }
    const student = await prisma.student.create({
      data: { studentId, name, subjectId },
    })
    res.json(student)
  } catch (err) {
    console.error('POST students error:', err)
    res.status(500).json({ error: 'เพิ่มนักศึกษาไม่สำเร็จ' })
  }
})

// POST /api/students/import
router.post('/import', async (req: Request, res: Response) => {
  const { subjectId, students } = req.body
  if (!subjectId || !Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: 'ข้อมูลไม่ครบ' })
    return
  }
  try {
    const results = await Promise.allSettled(
      students.map((s: { studentId: string; name: string }) =>
        prisma.student.upsert({
          where:  { studentId_subjectId: { studentId: s.studentId, subjectId } },
          update: { name: s.name },
          create: { studentId: s.studentId, name: s.name, subjectId },
        })
      )
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.filter(r => r.status === 'rejected').length
    res.json({ ok: true, succeeded, failed })
  } catch (err) {
    console.error('import students error:', err)
    res.status(500).json({ error: 'นำเข้าไม่สำเร็จ' })
  }
})

// PUT /api/students/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { studentId, name } = req.body
  try {
    const student = await prisma.student.update({
      where: { id: String(req.params.id) },
      data:  { studentId, name },
    })
    res.json(student)
  } catch (err) {
    console.error('PUT student error:', err)
    res.status(500).json({ error: 'แก้ไขไม่สำเร็จ' })
  }
})

// DELETE /api/students/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.student.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE student error:', err)
    res.status(500).json({ error: 'ลบไม่สำเร็จ' })
  }
})

// POST /api/students/match
router.post('/match', async (req: Request, res: Response) => {
  const { sheetId, detectedStudentId, subjectId } = req.body
  try {
    if (!detectedStudentId) {
      res.status(400).json({ error: 'ไม่มีรหัสนักศึกษาที่ตรวจพบ' })
      return
    }
    const student = await prisma.student.findFirst({
      where: { studentId: detectedStudentId, subjectId },
    })
    if (!student) {
      res.status(404).json({ error: `ไม่พบนักศึกษารหัส ${detectedStudentId} ในวิชานี้` })
      return
    }
    const sheet = await prisma.scannedSheet.update({
      where: { id: sheetId },
      data:  { studentId: student.id, detectedStudentId },
    })
    res.json({ ok: true, student, sheet })
  } catch (err) {
    console.error('match student error:', err)
    res.status(500).json({ error: 'จับคู่ไม่สำเร็จ' })
  }
})

export default router