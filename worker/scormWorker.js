// scorm.worker.js
const { Worker } = require('bullmq')
const connection = require('../util/redis')
const fs = require('fs')
const path = require('path')
const unzipper = require('unzipper')
const Activity = require('../model/Activity')

const BASE_PATH = path.resolve(process.cwd(), 'public', 'activity')

console.log('Worker')

const worker = new Worker(
  'scorm-extract',
  async job => {
    console.log('SCORM worker started')

    const { activityId, fileName, folderName } = job.data

    console.log('Job received:', job.data)

    const zipFilePath = path.join(BASE_PATH, fileName)
    const extractPath = path.join(BASE_PATH, folderName)

    try {
      await Activity.findByIdAndUpdate(activityId, {
        $set: { 'scorm_data.scorm_status': 'processing' }
      })

      await fs.promises.mkdir(extractPath, { recursive: true })

      const zip = await unzipper.Open.file(zipFilePath)

      // ⚡ faster streaming extraction
      for (const entry of zip.files) {
        const fullPath = path.join(extractPath, entry.path)
        const normalized = path.normalize(fullPath)

        if (!normalized.startsWith(extractPath)) {
          throw new Error('Invalid ZIP structure')
        }

        if (entry.type === 'Directory') {
          await fs.promises.mkdir(fullPath, { recursive: true })
          continue
        }

        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })

        await new Promise((resolve, reject) => {
          entry
            .stream()
            .pipe(fs.createWriteStream(fullPath))
            .on('finish', resolve)
            .on('error', reject)
        })
      }

      const manifestPath = findManifest(extractPath)
      if (!manifestPath) throw new Error('imsmanifest.xml missing')

      const xml = await fs.promises.readFile(manifestPath, 'utf8')
      if (!xml.includes('<manifest')) throw new Error('Invalid SCORM manifest')

      await fs.promises.unlink(zipFilePath)

      await Activity.findByIdAndUpdate(activityId, {
        $set: { 'scorm_data.scorm_status': 'completed' }
      })
    } catch (err) {
      console.error(err)

      await Activity.findByIdAndUpdate(activityId, {
        $set: { 'scorm_data.scorm_status': 'failed' }
      })
    }
  },
  { connection }
)

worker.on('completed', job => {
  console.log('✅ Completed:', job.id)
})

worker.on('failed', (job, err) => {
  console.log('❌ Failed:', job?.id, err)
})

// helper
function findManifest (dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const e of entries) {
    const full = path.join(dir, e.name)

    if (e.isDirectory()) {
      const res = findManifest(full)
      if (res) return res
    } else if (e.name.toLowerCase() === 'imsmanifest.xml') {
      return full
    }
  }
  return null
}
