import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { withAuth } from '../../../lib/auth/middleware'
import { db } from '../../../lib/db'

const UPLOAD_DIR = path.join(process.cwd(), 'frontend', 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// POST /api/upload — Upload file and save metadata
export const POST = withAuth(async (req, { user }) => {
  try {
    if (!user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tenant' },
        { status: 404 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File quá lớn (tối đa 10MB)' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = path.extname(file.name)
    const uniqueName = `${randomUUID()}${ext}`
    const filePath = path.join(UPLOAD_DIR, uniqueName)

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Save file to disk
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Build file URL
    const fileUrl = `/uploads/${uniqueName}`

    // Insert metadata into Attachment table
    const attachmentId = randomUUID()
    const entityType = (formData.get('entity_type') as string) || 'general'
    const entityId = (formData.get('entity_id') as string) || attachmentId

    await db.execute({
      sql: `INSERT INTO Attachment (id, tenant_id, entity_type, entity_id, file_name, file_url, file_size, mime_type, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        attachmentId,
        user.tenantId,
        entityType,
        entityId,
        file.name,
        fileUrl,
        file.size,
        file.type || null,
        user.id,
      ],
    })

    return NextResponse.json({
      success: true,
      data: {
        id: attachmentId,
        url: fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { success: false, error: 'Lỗi server' },
      { status: 500 }
    )
  }
})
