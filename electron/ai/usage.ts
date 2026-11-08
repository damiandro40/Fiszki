import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { atomicWrite } from '../storage/repository'
import { addAiResponseUsage, emptyAiUsage, normalizeAiUsage, type AiResponseTokens, type AiUsageSummary } from '../../src/lib/aiUsage'

const usageFile = () => join(app.getPath('userData'), 'ai-usage.json')

/** These statistics describe this installation only, never the plan's quota. */
export const loadAiUsage = async (): Promise<AiUsageSummary> => {
  try {
    return normalizeAiUsage(JSON.parse(await fs.readFile(usageFile(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyAiUsage()
    throw error
  }
}

export const recordAiUsage = async (tokens: AiResponseTokens | null): Promise<void> => {
  const summary = addAiResponseUsage(await loadAiUsage(), tokens, new Date().toISOString())
  await atomicWrite(usageFile(), summary)
}
