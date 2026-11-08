import { z } from 'zod'
import { timestampSchema } from '../storage/schemas'

const aiAttachmentSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(180),
  mime: z.enum(['image/webp', 'image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json']),
  dataUrl: z.string().max(1_800_000).regex(/^data:image\/(webp|jpeg|png);base64,[a-zA-Z0-9+/=]+$/).optional(),
  fileData: z.string().max(7_000_000).regex(/^data:application\/pdf;base64,[a-zA-Z0-9+/=]+$/).optional(),
  text: z.string().max(100_000).optional()
}).refine(item => item.mime.startsWith('image/') ? !!item.dataUrl && !item.text && !item.fileData
  : item.mime === 'application/pdf' ? !!item.fileData && !item.text && !item.dataUrl
  : !!item.text && !item.dataUrl && !item.fileData)
const aiMessageBaseSchema = z.object({
  role: z.enum(['user', 'assistant']), content: z.string().max(80_000),
  attachments: z.array(aiAttachmentSchema).max(4).optional()
})
const hasAiContent = (item: { content: string, attachments?: unknown[] }) => item.content.trim().length > 0 || (item.attachments?.length || 0) > 0
const aiMessageSchema = aiMessageBaseSchema.refine(hasAiContent)
const aiHistoryMessageSchema = aiMessageBaseSchema.extend({
  id: z.string().uuid(), createdAt: timestampSchema
}).refine(hasAiContent)
export const aiHistorySchema = z.array(aiHistoryMessageSchema).max(100)
export const aiRequestSchema = z.object({
  id: z.string().uuid(), model: z.string().min(1).max(140),
  instructions: z.string().max(24_000),
  messages: z.array(aiMessageSchema).min(1).max(22)
})

