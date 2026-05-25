const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getToken() {
  return localStorage.getItem('token') ?? ''
}
export function saveToken(token)  { localStorage.setItem('token', token) }
export function clearToken()      { localStorage.removeItem('token') }

async function apiFetch(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) =>
  fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json())

export const register = (data) =>
  fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json())

// ── Subjects ──────────────────────────────────────────────────────────────────
export const getSubjects   = () => apiFetch('/api/subjects')
export const createSubject = (data) => apiFetch('/api/subjects', { method: 'POST', body: JSON.stringify(data) })
export const updateSubject = (id, data) => apiFetch(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteSubject = (id) => apiFetch(`/api/subjects/${id}`, { method: 'DELETE' })

// ── Templates ─────────────────────────────────────────────────────────────────
export const getTemplates = () => apiFetch('/api/templates')
export const saveTemplate = (data) => apiFetch('/api/templates', { method: 'POST', body: JSON.stringify(data) })

// ── Scan ──────────────────────────────────────────────────────────────────────
export const createSession = (data) => apiFetch('/api/scan/session', { method: 'POST', body: JSON.stringify(data) })
export const getResults    = (templateId) => apiFetch(`/api/scan/results/${templateId}`)

export const saveSheet = async (sessionId, setId, file) => {
  const formData = new FormData()
  formData.append('image',     file)
  formData.append('sessionId', sessionId)
  formData.append('setId',     setId)
  const res = await fetch(`${BASE}/api/scan/sheet`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body:    formData,
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    const msg = errData?.error || await res.text()
    const err = new Error(msg)
    err.data = errData
    throw err
  }
  return res.json()
}

// ── Detect Answer (ใช้ setId — ต้อง save template ก่อน) ──────────────────────
export const detectAnswer = async (setId, file) => {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('setId', setId)
  const res = await fetch(`${BASE}/api/templates/detect-answer`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body:    formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Detect Answer With Boxes (ส่ง boxes โดยตรง — ไม่ต้อง save ก่อน) ──────────
export const detectAnswerWithBoxes = async (file, boundingBoxes) => {
  const formData = new FormData()
  formData.append('image',         file)
  formData.append('boundingBoxes', JSON.stringify(boundingBoxes))
  const res = await fetch(`${BASE}/api/templates/detect-answer`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body:    formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Students ──────────────────────────────────────────────────────────────────
export const getStudents    = (subjectId) => apiFetch(`/api/students?subjectId=${subjectId}`)
export const createStudent  = (data) => apiFetch('/api/students', { method: 'POST', body: JSON.stringify(data) })
export const updateStudent  = (id, data) => apiFetch(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteStudent  = (id) => apiFetch(`/api/students/${id}`, { method: 'DELETE' })
export const matchStudent   = (data) => apiFetch('/api/students/match', { method: 'POST', body: JSON.stringify(data) })

// นำเข้านักศึกษาจาก array [{ studentId, name }]
export const importStudents = (subjectId, students) =>
  apiFetch('/api/students/import', {
    method: 'POST',
    body:   JSON.stringify({ subjectId, students }),
  })