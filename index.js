require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const overlayNumber = require('./utils/overlayNumber')
const { submitReport, WHATSAPP_ENDPOINTS } = require('./utils/submitReport')
const { tempTemplates, permTemplates } = require('./utils/reportTemplates')
const { getWorkingProxy } = require('./utils/proxyChecker')

const app = express()
app.use(cors())
app.use(express.json())

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nullbanroute'

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err))

// Job schema
const jobSchema = new mongoose.Schema({
    jobId: { type: String, unique: true },
    phone: String,
    banType: String,
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    progress: { type: Number, default: 0 },
    reportCount: Number,
    totalEndpoints: Number,
    usedEndpoints: [String],
    logs: [{
        time: Date,
        message: String
    }],
    error: String,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
})

const Job = mongoose.model('Job', jobSchema)

// load pools
const emailPool = JSON.parse(fs.readFileSync('./email-pool.json', 'utf8'))
const proxyPool = JSON.parse(fs.readFileSync('./proxy-pool.json', 'utf8'))

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp')
const evidenceTemplates = fs.readdirSync('./evidence').filter(f => f.endsWith('.jpg') || f.endsWith('.png'))

console.log(`📧 Email pool: ${emailPool.length} accounts loaded`)
console.log(`🌐 Proxy pool: ${proxyPool.length} proxies loaded`)
console.log(`🖼️ Evidence: ${evidenceTemplates.length} templates found`)
console.log(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length} endpoints`)

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

    // create job in database
    const job = new Job({
        jobId,
        phone,
        banType,
        status: 'queued',
        progress: 0,
        reportCount,
        totalEndpoints: WHATSAPP_ENDPOINTS.length,
        logs: []
    })
    await job.save()

    // run in background
    executeJob(jobId, phone, banType, templates, reportCount)

    res.json({ jobId, message: `Started ${banType} ban for ${phone}` })
})

// status endpoint
app.get('/api/status/:jobId', async (req, res) => {
    const job = await Job.findOne({ jobId: req.params.jobId })
    if (!job) return res.status(404).json({ error: 'job not found' })
    res.json(job)
})

// list jobs (with pagination)
app.get('/api/jobs', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * limit

    const jobs = await Job.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)

    const total = await Job.countDocuments()

    res.json({
        jobs,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    })
})

// delete job
app.delete('/api/jobs/:jobId', async (req, res) => {
    await Job.deleteOne({ jobId: req.params.jobId })
    res.json({ success: true })
})

async function executeJob(jobId, phone, banType, templates, count) {
    const job = await Job.findOne({ jobId })
    if (!job) return

    async function updateLog(message) {
        job.logs.push({
            time: new Date(),
            message
        })
        await job.save()
        console.log(`[${jobId}] ${message}`)
    }

    async function updateProgress(val) {
        job.progress = val
        await job.save()
    }

    try {
        job.status = 'running'
        await job.save()

        await updateLog(`🚀 Starting ${banType} ban for ${phone}`)
        await updateLog(`📊 Report count: ${count}`)
        await updateLog(`📧 Email pool: ${emailPool.length} accounts`)
        await updateLog(`🖼️ Evidence templates: ${evidenceTemplates.length}`)
        await updateLog(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length}`)

        const shuffledEvidence = [...evidenceTemplates].sort(() => Math.random() - 0.5)
        const evidenceCycle = shuffledEvidence.length > 0 ? shuffledEvidence : ['template1.jpg']
        let usedEndpoints = []

        for (let i = 0; i < count; i++) {
            const emailAccount = emailPool[i % emailPool.length]
            let proxy = await getWorkingProxy(proxyPool)
            if (!proxy) {
                await updateLog(`⚠️ No working proxies — falling back to direct connection`)
                proxy = null
            }

            const template = templates[i % templates.length]
            const evidenceFile = evidenceCycle[i % evidenceCycle.length]
            const templatePath = path.join('./evidence', evidenceFile)
            const outputPath = path.join('./temp', `${Date.now()}_${i}.jpg`)

            await updateLog(`📝 Report ${i+1}/${count}: overlaying number`)

            try {
                await overlayNumber(templatePath, phone, outputPath)
            } catch (err) {
                await updateLog(`❌ Overlay failed: ${err.message} — using template directly`)
                fs.copyFileSync(templatePath, outputPath)
            }

            await updateLog(`📤 Report ${i+1}/${count}: submitting via ${emailAccount.email}`)

            const result = await submitReport(
                emailAccount,
                proxy,
                outputPath,
                template,
                phone
            )

            try { fs.unlinkSync(outputPath) } catch (e) {}

            if (result.success) {
                usedEndpoints.push(result.endpoint)
                await updateLog(`✅ Report ${i+1}/${count}: sent via ${result.endpoint}`)
            } else {
                await updateLog(`❌ Report ${i+1}/${count}: failed — ${result.error}`)
            }

            const pct = Math.round(((i + 1) / count) * 100)
            await updateProgress(pct)

            await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))
        }

        const uniqueEndpoints = [...new Set(usedEndpoints)]
        job.usedEndpoints = uniqueEndpoints
        await updateLog(`✅ ${banType.toUpperCase()} ban complete for ${phone}`)
        await updateLog(`📊 Used ${usedEndpoints.length} reports across ${uniqueEndpoints.length} unique endpoints`)
        await updateLog(`📬 Endpoints: ${uniqueEndpoints.join(', ')}`)
        
        job.status = 'completed'
        job.completedAt = new Date()
        await job.save()

    } catch (error) {
        await updateLog(`❌ Fatal error: ${error.message}`)
        job.status = 'failed'
        job.error = error.message
        await job.save()
    }
}

app.listen(process.env.PORT || 3000, () => {
    console.log(`\n🔫 Null-Ban-Route backend running on port ${process.env.PORT || 3000}`)
    console.log(`📧 ${emailPool.length} email accounts`)
    console.log(`🌐 ${proxyPool.length} proxies (with dead-checking)`)
    console.log(`📬 ${WHATSAPP_ENDPOINTS.length} WhatsApp endpoints\n`)
})
