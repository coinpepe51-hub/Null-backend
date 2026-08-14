require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const overlayNumber = require('./utils/overlayNumber')
const { submitReport, WHATSAPP_ENDPOINTS } = require('./utils/submitReport')
const { tempTemplates, permTemplates } = require('./utils/reportTemplates')
const { getWorkingProxy } = require('./utils/proxyChecker')

const app = express()
app.use(cors())
app.use(express.json())

// load pools
const emailPool = JSON.parse(fs.readFileSync('./email-pool.json', 'utf8'))
const proxyPool = JSON.parse(fs.readFileSync('./proxy-pool.json', 'utf8'))

// ensure temp and evidence directories exist
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')
const evidenceTemplates = fs.readdirSync('./evidence').filter(f => f.endsWith('.jpg') || f.endsWith('.png'))

console.log(`📧 Email pool: ${emailPool.length} accounts loaded`)
console.log(`🌐 Proxy pool: ${proxyPool.length} proxies loaded`)
console.log(`🖼️ Evidence: ${evidenceTemplates.length} templates found`)
console.log(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length} endpoints`)

let runningJobs = new Map()

// execute ban endpoint
app.post('/api/execute', async (req, res) => {
    const { phone, banType } = req.body

    if (!phone || !banType) {
        return res.status(400).json({ error: 'phone and banType required' })
    }

    if (!phone.match(/^\+\d{8,15}$/)) {
        return res.status(400).json({ error: 'invalid phone format — use + followed by digits' })
    }

    if (!['temp', 'perm'].includes(banType)) {
        return res.status(400).json({ error: 'banType must be "temp" or "perm"' })
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const reportCount = banType === 'perm' ? 20 : 10
    const templates = banType === 'perm' ? permTemplates : tempTemplates

    const job = {
        status: 'running',
        progress: 0,
        logs: [],
        phone,
        banType,
        reportCount,
        totalEndpoints: WHATSAPP_ENDPOINTS.length,
        createdAt: new Date().toISOString()
    }

    runningJobs.set(jobId, job)

    // run in background
    executeJob(jobId, phone, banType, templates, reportCount)

    res.json({ jobId, message: `Started ${banType} ban for ${phone}` })
})

// status endpoint
app.get('/api/status/:jobId', (req, res) => {
    const job = runningJobs.get(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'job not found' })
    res.json(job)
})

// list jobs
app.get('/api/jobs', (req, res) => {
    const jobs = Array.from(runningJobs.entries()).map(([id, job]) => ({
        id,
        ...job
    }))
    res.json(jobs)
})

async function executeJob(jobId, phone, banType, templates, count) {
    const job = runningJobs.get(jobId)
    let progress = 0

    function updateLog(message) {
        job.logs.push({
            time: new Date().toISOString(),
            message
        })
        console.log(`[${jobId}] ${message}`)
    }

    function updateProgress(val) {
        progress = val
        job.progress = val
    }

    try {
        updateLog(`🚀 Starting ${banType} ban for ${phone}`)
        updateLog(`📊 Report count: ${count}`)
        updateLog(`📧 Email pool: ${emailPool.length} accounts`)
        updateLog(`🖼️ Evidence templates: ${evidenceTemplates.length}`)
        updateLog(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length}`)

        // select evidence files
        const shuffledEvidence = [...evidenceTemplates].sort(() => Math.random() - 0.5)
        const evidenceCycle = shuffledEvidence.length > 0 ? shuffledEvidence : ['template1.jpg']

        // used endpoints tracker
        let usedEndpoints = []

        for (let i = 0; i < count; i++) {
            const emailAccount = emailPool[i % emailPool.length]
            
            // get working proxy (with dead-check)
            let proxy = await getWorkingProxy(proxyPool)
            if (!proxy) {
                updateLog(`⚠️ No working proxies — falling back to direct connection`)
                proxy = null
            }

            const template = templates[i % templates.length]
            const evidenceFile = evidenceCycle[i % evidenceCycle.length]
            const templatePath = path.join('./evidence', evidenceFile)
            const outputPath = path.join('./temp', `${Date.now()}_${i}.jpg`)

            updateLog(`📝 Report ${i+1}/${count}: overlaying number on evidence`)

            try {
                await overlayNumber(templatePath, phone, outputPath)
            } catch (err) {
                updateLog(`❌ Overlay failed: ${err.message} — using template directly`)
                // copy template to output
                fs.copyFileSync(templatePath, outputPath)
            }

            updateLog(`📤 Report ${i+1}/${count}: submitting via ${emailAccount.email}`)

            const result = await submitReport(
                emailAccount,
                proxy,
                outputPath,
                template,
                phone
            )

            // clean up
            try { fs.unlinkSync(outputPath) } catch (e) {}

            if (result.success) {
                usedEndpoints.push(result.endpoint)
                updateLog(`✅ Report ${i+1}/${count}: sent via ${result.endpoint} (${result.messageId})`)
            } else {
                updateLog(`❌ Report ${i+1}/${count}: failed — ${result.error}`)
            }

            const pct = Math.round(((i + 1) / count) * 100)
            updateProgress(pct)

            // random delay between reports
            await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))
        }

        // unique endpoints used
        const uniqueEndpoints = [...new Set(usedEndpoints)]
        updateLog(`✅ ${banType.toUpperCase()} ban execution complete for ${phone}`)
        updateLog(`📊 Used ${usedEndpoints.length} reports across ${uniqueEndpoints.length} unique endpoints`)
        updateLog(`📬 Endpoints used: ${uniqueEndpoints.join(', ')}`)
        job.status = 'completed'
        job.completedAt = new Date().toISOString()
        job.usedEndpoints = uniqueEndpoints

    } catch (error) {
        updateLog(`❌ Fatal error: ${error.message}`)
        job.status = 'failed'
        job.error = error.message
    }
}

app.listen(process.env.PORT || 3000, () => {
    console.log(`\n🔫 Null-Ban-Route backend running on port ${process.env.PORT || 3000}`)
    console.log(`📧 ${emailPool.length} email accounts loaded`)
    console.log(`🌐 ${proxyPool.length} proxies loaded (with dead-checking)`)
    console.log(`📬 ${WHATSAPP_ENDPOINTS.length} WhatsApp endpoints\n`)
})
