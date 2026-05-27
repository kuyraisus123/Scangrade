import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import authRouter     from './routes/auth.ts'
import subjectsRouter from './routes/subjects.ts'
import templatesRouter from './routes/templates.ts'
import scanRouter     from './routes/scan.ts'
import studentsRouter from './routes/students.ts'

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

const app = express()
app.use(cors({ origin: ['http://localhost:5173', 'https://pure-beauty-production-fcc1.up.railway.app', 'https://scangrade.up.railway.app'] }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use('/auth', authRouter)

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'ไม่ได้ login' })
    return
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'token ไม่ถูกต้อง' })
  }
})

app.use('/api/subjects',  subjectsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/scan',      scanRouter)
app.use('/api/students',  studentsRouter)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
})