import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'
import { uploadToCloudinary } from '../lib/cloudinary'

const router  = Router()
const upload  = multer({ storage: multer.memoryStorage() })

router.post('/session', async (req: Request, res: Response) => {
  try {
    const { templateId, setId } = req.body
    const session = await prisma.scanSession.create({
      data: { templateId, setId, userId: req.userId },
    })
    res.json(session)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.post('/sheet', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { sessionId, setId } = req.body

    if (!req.file) {
      res.status(400).json({ error: 'ไม่มีไฟล์รูปภาพ' })
      return
    }

    const templateSet = await prisma.templateSet.findUnique({
      where:   { id: setId },
      include: { boundingBoxes: true },
    })
    if (!templateSet) {
      res.status(404).json({ error: 'ไม่พบ template set' })
      return
    }

    const session = await prisma.scanSession.findUnique({
      where:   { id: sessionId },
      include: { template: { include: { subject: true } } },
    })

    const imageBase64 = req.file.buffer.toString('base64')

    // ส่ง boundingBoxes พร้อม type และ isAnswer ให้ FastAPI
    const answerKey = templateSet.boundingBoxes.map((b: any) => ({
      questionNumber: b.questionNumber,
      x:        b.x,
      y:        b.y,
      w:        b.w,
      h:        b.h,
      isAnswer: b.isAnswer,
      type:     b.type || 'answer',
    }))

    const { default: fetch } = await import('node-fetch')
    const totalQuestions = session?.template?.totalQuestions ?? 1
    const totalScore     = session?.template?.totalScore     ?? 100
    const scorePerQ      = totalQuestions > 0 ? totalScore / totalQuestions : 2

    const gradeRes = await fetch(`${process.env.PYTHON_URL || 'http://localhost:5000'}/grade`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image:              imageBase64,
        answer_key:         answerKey,
        total_score:        totalScore,
        score_per_question: scorePerQ,
        choices:            Math.round(
          answerKey.filter((b: any) => b.type === 'answer').length /
          (totalQuestions ?? 1)
        ) || 5,
      }),
    })

    const gradeData = await gradeRes.json() as any

    if (gradeData.detail) {
      res.status(500).json({ error: gradeData.detail })
      return
    }

    // เช็ค set_number ที่ detect ได้ว่าตรงกับ set ที่เลือกไหม
    const selectedSet = await prisma.templateSet.findUnique({ where: { id: setId } })
    const detectedSet = gradeData.detected_set_number
    if (detectedSet !== null && detectedSet !== undefined && selectedSet) {
      if (detectedSet !== selectedSet.order) {
        res.status(400).json({
          error: `ชุดข้อสอบไม่ตรงกัน: กระดาษเป็นชุดที่ ${detectedSet} แต่เลือก template ชุดที่ ${selectedSet.order}`,
          detectedSet,
          selectedSet: selectedSet.order,
        })
        return
      }
    }

    // Upload รูปไป Cloudinary
    let imageUrl = req.file.originalname
    try {
      const filename = `sheet_${sessionId}_${Date.now()}`
      imageUrl = await uploadToCloudinary(req.file.buffer, 'scangrade/sheets', filename)
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr)
    }

    const sheet = await prisma.scannedSheet.create({
      data: {
        sessionId,
        imageUrl,
        score:             gradeData.score,
        wrongCount:        gradeData.wrong_items.length,
        status:            'done',
        detectedStudentId: gradeData.detected_student_id ?? null,
        wrongItems: {
          create: gradeData.wrong_items.map((q: number) => ({ questionNumber: q })),
        },
      },
      include: { wrongItems: true },
    })

    // Auto-match นักศึกษา
    let matchedStudent = null
    if (gradeData.detected_student_id && session?.template?.subjectId) {
      try {
        matchedStudent = await prisma.student.findFirst({
          where: {
            studentId: gradeData.detected_student_id,
            subjectId: session.template.subjectId,
          },
        })
        if (matchedStudent) {
          await prisma.scannedSheet.update({
            where: { id: sheet.id },
            data:  { studentId: matchedStudent.id },
          })
        }
      } catch {
        // auto-match ไม่สำเร็จ
      }
    }

    res.json({
      ...sheet,
      gradeDetail:       gradeData,
      detectedStudentId: gradeData.detected_student_id ?? null,
      matchedStudent,
      wrongItems:        sheet.wrongItems,
    })
  } catch (err) {
    console.error('scan sheet error:', err)
    res.status(500).json({ error: 'ตรวจไม่สำเร็จ' })
  }
})

router.get('/results/:templateId', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.scanSession.findMany({
      where: { templateId: String(req.params.templateId), userId: req.userId },
      include: {
        sheets: {
          include: { wrongItems: true, student: true },
        },
      },
    })
    res.json(sessions)
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

export default router