import yaml from 'js-yaml'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

async function migrateSettings() {
  console.log('Migrating settings.yaml...')

  const settingsPath = path.join(process.cwd(), 'config/settings.yaml')
  const content = await fs.readFile(settingsPath, 'utf-8')
  const settings = yaml.load(content) as any

  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {
      defaultProvider: settings.ai.defaultProvider,
      defaultBatchSize: settings.ai.defaultBatchSize,
      defaultConcurrency: settings.ai.defaultConcurrency,
      maxRetries: settings.ai.retry.maxRetries,
      initialDelay: settings.ai.retry.initialDelay,
      maxDelay: settings.ai.retry.maxDelay,
      backoffFactor: settings.ai.retry.backoffFactor,
      anthropicConfig: JSON.stringify(settings.ai.anthropic),
      geminiConfig: JSON.stringify(settings.ai.gemini),
      openaiConfig: JSON.stringify(settings.ai.openai),
    },
    create: {
      id: 'default',
      defaultProvider: settings.ai.defaultProvider,
      defaultBatchSize: settings.ai.defaultBatchSize,
      defaultConcurrency: settings.ai.defaultConcurrency,
      maxRetries: settings.ai.retry.maxRetries,
      initialDelay: settings.ai.retry.initialDelay,
      maxDelay: settings.ai.retry.maxDelay,
      backoffFactor: settings.ai.retry.backoffFactor,
      anthropicConfig: JSON.stringify(settings.ai.anthropic),
      geminiConfig: JSON.stringify(settings.ai.gemini),
      openaiConfig: JSON.stringify(settings.ai.openai),
    },
  })

  console.log('Settings migrated')
}

async function migrateScheduler() {
  console.log('Migrating scheduler.yaml...')

  const schedulerPath = path.join(process.cwd(), 'config/scheduler.yaml')
  const content = await fs.readFile(schedulerPath, 'utf-8')
  const scheduler = yaml.load(content) as any

  for (const [id, job] of Object.entries(scheduler.scheduler.jobs)) {
    await prisma.schedulerJob.upsert({
      where: { id },
      update: {
        name: id,
        cron: (job as any).cron,
        description: (job as any).description,
        enabled: (job as any).enabled,
      },
      create: {
        id,
        name: id,
        cron: (job as any).cron,
        description: (job as any).description,
        enabled: (job as any).enabled,
      },
    })
  }

  console.log('Scheduler jobs migrated')
}

async function migrateReportConfigs() {
  console.log('Migrating report configs...')

  // Daily report config
  const dailyPath = path.join(process.cwd(), 'config/reports/daily.yaml')
  const dailyContent = await fs.readFile(dailyPath, 'utf-8')
  const daily = yaml.load(dailyContent) as any

  await prisma.dailyReportConfig.upsert({
    where: { id: 'default' },
    update: {
      packs: daily.daily.packs,
      maxItems: daily.daily.maxItems,
      sort: daily.daily.sort,
      enableOverview: daily.daily.enableOverview,
      newsFlashesEnabled: daily.daily.newsFlashes.enabled,
      newsFlashesMaxCount: daily.daily.newsFlashes.maxCount,
    },
    create: {
      id: 'default',
      packs: daily.daily.packs,
      maxItems: daily.daily.maxItems,
      sort: daily.daily.sort,
      enableOverview: daily.daily.enableOverview,
      newsFlashesEnabled: daily.daily.newsFlashes.enabled,
      newsFlashesMaxCount: daily.daily.newsFlashes.maxCount,
    },
  })

  // Weekly report config
  const weeklyPath = path.join(process.cwd(), 'config/reports/weekly.yaml')
  const weeklyContent = await fs.readFile(weeklyPath, 'utf-8')
  const weekly = yaml.load(weeklyContent) as any

  await prisma.weeklyReportConfig.upsert({
    where: { id: 'default' },
    update: {
      days: weekly.weekly.days,
      maxTimelineEvents: weekly.weekly.maxTimelineEvents,
      maxDeepDives: weekly.weekly.maxDeepDives,
      enableEditorial: weekly.weekly.enableEditorial,
    },
    create: {
      id: 'default',
      days: weekly.weekly.days,
      maxTimelineEvents: weekly.weekly.maxTimelineEvents,
      maxDeepDives: weekly.weekly.maxDeepDives,
      enableEditorial: weekly.weekly.enableEditorial,
    },
  })

  console.log('Report configs migrated')
}

async function migrateAuthConfig() {
  console.log('Migrating auth config...')

  const authPath = path.join(process.cwd(), 'config/auth/x-family.yaml')
  const content = await fs.readFile(authPath, 'utf-8')
  const auth = yaml.load(content) as any

  await prisma.authConfig.upsert({
    where: { id: 'default' },
    update: {
      adapter: auth.adapter,
      configJson: JSON.stringify(auth.config),
    },
    create: {
      id: 'default',
      adapter: auth.adapter,
      configJson: JSON.stringify(auth.config),
    },
  })

  console.log('Auth config migrated')
}

async function migratePacks() {
  console.log('Migrating packs...')

  const packsDir = path.join(process.cwd(), 'config/packs')
  const files = await fs.readdir(packsDir)

  for (const file of files) {
    if (!file.endsWith('.yaml')) continue

    const filePath = path.join(packsDir, file)
    const content = await fs.readFile(filePath, 'utf-8')
    const packData = yaml.load(content) as any

    if (!packData.pack?.id) {
      console.log(`Skipping ${file}: no pack.id found`)
      continue
    }

    // Upsert Pack
    await prisma.pack.upsert({
      where: { id: packData.pack.id },
      update: {
        name: packData.pack.name || packData.pack.id,
        description: packData.pack.description || null,
        policyJson: packData.pack.auth ? JSON.stringify({ auth: packData.pack.auth }) : null,
      },
      create: {
        id: packData.pack.id,
        name: packData.pack.name || packData.pack.id,
        description: packData.pack.description || null,
        policyJson: packData.pack.auth ? JSON.stringify({ auth: packData.pack.auth }) : null,
      },
    })

    // Upsert Sources
    for (const source of packData.sources || []) {
      // Generate a stable source ID based on pack, type, and url
      const sourceId = source.id || `${packData.pack.id}-${source.type}-${Buffer.from(source.url || '').toString('base64').slice(0, 20)}`

      await prisma.source.upsert({
        where: { id: sourceId },
        update: {
          type: source.type,
          name: source.description || source.url || sourceId,
          url: source.url || null,
          description: source.description || null,
          enabled: source.enabled !== false,
          configJson: source.configJson || JSON.stringify(source.config || {}),
          packId: packData.pack.id,
        },
        create: {
          id: sourceId,
          type: source.type,
          name: source.description || source.url || sourceId,
          url: source.url || null,
          description: source.description || null,
          enabled: source.enabled !== false,
          configJson: source.configJson || JSON.stringify(source.config || {}),
          packId: packData.pack.id,
        },
      })
    }

    console.log(`Pack "${packData.pack.name}" migrated with ${packData.sources?.length || 0} sources`)
  }
}

async function main() {
  console.log('Starting YAML to database migration...\n')

  try {
    await migrateSettings()
    await migrateScheduler()
    await migrateReportConfigs()
    await migrateAuthConfig()
    await migratePacks()

    console.log('\nMigration completed successfully!')
  } catch (error) {
    console.error('\nMigration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
