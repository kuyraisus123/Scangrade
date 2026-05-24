import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body
  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      res.status(400).json({ error: 'อีเมลนี้ถูกใช้แล้ว' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash },
    })
    const token = jwt.sign(
      { userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )
    res.json({ token, user: { id: user.id, firstName, lastName, email } })
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'ไม่พบผู้ใช้งาน' })
      return
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' })
      return
    }
    const token = jwt.sign(
      { userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    )
    res.json({
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
    })
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' })
  }
})

export default router