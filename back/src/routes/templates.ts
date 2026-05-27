import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await prisma.examTemplate.findMany({
      where: { userId: req.userId },
      include: {
        subject: true,
        sets: {
          include: {
            boundingBoxes: true,
            scanSessions: {
              include: {
                sheets: {
                  include: { wrongItems: true, student: true }
                }
              }
            }
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(templates)
  } catch (err) {
    console.error('GET templates error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const { id, examName, subjectId, examType, semester, year,
          totalQuestions, totalScore, scorePerQuestion, sets } = req.body
  try {
    const existingTemplate = id ? await prisma.examTemplate.findUnique({ where: { id } }) : null

    const template = existingTemplate
      ? await prisma.examTemplate.update({
          where: { id },
          data: {
            name: examName, examType, semester,
            year: year || '',
            totalQuestions:   +totalQuestions   || 0,
            totalScore:       +totalScore       || 0,
            scorePerQuestion: +scorePerQuestion || 0,
          },
        })
      : await prisma.examTemplate.create({
          data: {
            name: examName, subjectId, examType, semester,
            year: year || '',
            totalQuestions:   +totalQuestions   || 0,
            totalScore:       +totalScore       || 0,
            scorePerQuestion: +scorePerQuestion || 0,
            userId: req.userId,
          },
        })

    for (const set of sets) {
      const existingSet = await prisma.templateSet.findFirst({
        where: { templateId: template.id, order: set.order }
      })

      const savedSet = existingSet
        ? await prisma.templateSet.update({
            where: { id: existingSet.id },
            data:  { label: set.label },
          })
        : await prisma.templateSet.create({
            data: {
              label: set.label,
              order: set.order,
              templateId: template.id,
            },
          })

      if (!set.rectangles || set.rectangles.length === 0) {
        continue
      }

      const existingBoxes = await prisma.boundingBox.findMany({ where: { setId: savedSet.id } })
      const isAnswerMap: Record<number, boolean> = {}
      for (const b of existingBoxes) {
        if (b.isAnswer) isAnswerMap[b.questionNumber] = true
      }

      await prisma.boundingBox.deleteMany({ where: { setId: savedSet.id } })
      let answerIdx = 0;
      const boundingBoxData = set.rectangles.map((r: any, i: number) => {
        const choices = set.choices || 5;
        let questionNumber = 1;
        if (r.type === 'answer' || !r.type) {
          answerIdx++;
          questionNumber = answerIdx;
          if (r.qNum != null && r.choiceIdx != null) {
            questionNumber = (r.qNum - 1) * choices + r.choiceIdx + 1;
          }
        }
          if (!r.x || !r.w) return null;

          if (r.type === 'set_number') {
            const setNumQ = r.qNum ?? (() => {
              const sorted = set.rectangles
                .filter((x: any) => x.type === 'set_number')
                .sort((a: any, b: any) => a.y - b.y);
              return sorted.findIndex((x: any) => x.id === r.id) + 1;
            })();
            return {
              questionNumber: setNumQ,
              x: r.x, y: r.y, w: r.w, h: r.h,
              type: 'set_number',
              setId: savedSet.id,
              isAnswer: isAnswerMap[setNumQ] ?? false,
            };
          }

          if (r.type === 'student_id') {
            const qn = r.qNum != null && r.choiceIdx != null
              ? (r.qNum - 1) * 10 + r.choiceIdx + 1
              : (i + 1);
            console.log(`student_id r[${i}] qNum=${r.qNum} choiceIdx=${r.choiceIdx} → qn=${qn}`)
            return {
              questionNumber: qn,
              x: r.x, y: r.y, w: r.w, h: r.h,
              type: 'student_id',
              setId: savedSet.id,
              isAnswer: false,
            };
          }

          return {
            questionNumber,
            x: r.x, y: r.y, w: r.w, h: r.h,
            type: r.type || 'answer',
            setId: savedSet.id,
            isAnswer: isAnswerMap[questionNumber] ?? false,
          };
        }).filter((item: any) => item !== null)

      await prisma.boundingBox.createMany({ data: boundingBoxData })
    }

    res.json({ ok: true, id: template.id })
  } catch (err) {
    console.error('POST templates error:', err)
    res.status(500).json({ error: 'บันทึกไม่สำเร็จ' })
  }
})

router.post('/detect-answer', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'ไม่มีไฟล์รูปภาพ' })
      return
    }

    let boundingBoxes: any[] = []

    if (req.body.boundingBoxes) {
      try {
        boundingBoxes = JSON.parse(req.body.boundingBoxes)
      } catch {
        res.status(400).json({ error: 'boundingBoxes format ไม่ถูกต้อง' })
        return
      }
    } else if (req.body.setId) {
      const templateSet = await prisma.templateSet.findUnique({
        where:   { id: req.body.setId },
        include: { boundingBoxes: true },
      })
      if (!templateSet) {
        res.status(404).json({ error: 'ไม่พบ template set' })
        return
      }
      boundingBoxes = templateSet.boundingBoxes
    } else {
      res.status(400).json({ error: 'ต้องส่ง boundingBoxes หรือ setId' })
      return
    }

    const imageBase64 = req.file.buffer.toString('base64')
    const axios = require('axios')
    const detectRes = await axios.post(`${process.env.PYTHON_URL || 'http://localhost:5000'}/detect-answer`, {
      image: imageBase64,
      bounding_boxes: boundingBoxes,
    })
    const detectData = detectRes.data
    if (detectData.detail) {
      res.status(500).json({ error: detectData.detail })
      return
    }

    res.json({ ok: true, answer_key: detectData.answer_key })
  } catch (err) {
    console.error('detect-answer error:', err)
    res.status(500).json({ error: 'ตรวจเฉลยไม่สำเร็จ' })
  }
})

router.post('/confirm-answer', async (req: Request, res: Response) => {
  try {
    const { setId, answerKey } = req.body
    if (!setId || !answerKey || !Array.isArray(answerKey)) {
      res.status(400).json({ error: 'ข้อมูลไม่ครบ' })
      return
    }

    console.log('confirm-answer setId:', setId)
    console.log('confirm-answer total boxes:', answerKey.length)
    console.log('confirm-answer isAnswer=true count:', answerKey.filter((b: any) => b.isAnswer).length)

    const trueBoxes = answerKey.filter((b: any) => b.isAnswer)
    console.log('isAnswer=true boxes:', JSON.stringify(trueBoxes.slice(0, 10)))

    const templateSet = await prisma.templateSet.findUnique({
      where:   { id: setId },
      include: { boundingBoxes: true },
    })
    if (!templateSet) {
      res.status(404).json({ error: 'ไม่พบ template set' })
      return
    }

    console.log('DB boundingBoxes count:', templateSet.boundingBoxes.length)
    console.log('DB sample questionNumbers:', templateSet.boundingBoxes.slice(0,5).map((b: any) => b.questionNumber))

    let updateCount = 0
    for (const box of answerKey) {
      if (box.type !== 'answer' && box.type) continue
      if (box.questionNumber <= 0) continue
      const existing = templateSet.boundingBoxes.find((b: any) => b.questionNumber === box.questionNumber && b.type === 'answer')
      if (existing) {
        await prisma.boundingBox.update({
          where: { id: existing.id },
          data:  { isAnswer: box.isAnswer },
        })
        updateCount++
      }
    }

    console.log('confirm-answer updated:', updateCount, 'boxes')
    res.json({ ok: true })
  } catch (err) {
    console.error('confirm-answer error:', err)
    res.status(500).json({ error: 'บันทึกเฉลยไม่สำเร็จ' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const sessions = await prisma.scanSession.findMany({ where: { templateId: id }, include: { sheets: true } })
    for (const session of sessions) {
      for (const sheet of session.sheets) {
        await prisma.wrongItem.deleteMany({ where: { sheetId: sheet.id } })
        await prisma.scannedSheet.delete({ where: { id: sheet.id } })
      }
      await prisma.scanSession.delete({ where: { id: session.id } })
    }
    await prisma.examTemplate.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE template error:', err)
    res.status(500).json({ error: 'ลบไม่สำเร็จ' })
  }
})

export default router