require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const axios = require('axios')

const app = express()
app.use(cors())
app.use(express.json())

// ============================================================
// MONGODB
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nullbanroute'

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message))

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

// ============================================================
// WHATSAPP ENDPOINTS (20+)
// ============================================================
const WHATSAPP_ENDPOINTS = [
    'support@whatsapp.com',
    'abuse@whatsapp.com',
    'safety@whatsapp.com',
    'compliance@whatsapp.com',
    'legal@whatsapp.com',
    'dsa@whatsapp.com',
    'trustandsafety@whatsapp.com',
    'privacy@whatsapp.com',
    'report@whatsapp.com',
    'security@whatsapp.com',
    'escalations@whatsapp.com',
    'integrity@whatsapp.com',
    'platform@whatsapp.com',
    'enforcement@whatsapp.com',
    'operations@whatsapp.com',
    'risk@whatsapp.com',
    'fraud@whatsapp.com',
    'investigations@whatsapp.com',
    'appeals@whatsapp.com',
    'trust@whatsapp.com'
]

// ============================================================
// EMAIL ACCOUNTS
// ============================================================
function getEmailAccounts() {
    const accounts = []
    let i = 1
    while (process.env[`EMAIL_${i}`] && process.env[`EMAIL_APP_PASSWORD_${i}`]) {
        accounts.push({
            user: process.env[`EMAIL_${i}`],
            pass: process.env[`EMAIL_APP_PASSWORD_${i}`]
        })
        i++
    }
    return accounts
}

const FALLBACK_EMAILS = [
    {"user": "sin146744@gmail.com", "pass": "quyjgdcgzfocrkaj"},
    {"user": "heisweaver253@gmail.com", "pass": "xzrtrswvvgzepkyf"},
    {"user": "jinwokmonarch@gmail.com", "pass": "zwvnzbbdqfotcycp"},
    {"user": "kaiwilliams149@gmail.com", "pass": "naegfrdusayolrsd"},
    {"user": "vicentehenry143@gmail.com", "pass": "ifeunqzqbaztrmju"},
    {"user": "kaiwilliams930@gmail.com", "pass": "cwaapuwovrlrodum"},
    {"user": "vicentehenry710@gmail.com", "pass": "mdccbylzzapfzcmn"},
    {"user": "vicentehenry656@gmail.com", "pass": "hmrpkjudaifebmgv"}
]

const emailAccounts = getEmailAccounts().length > 0 ? getEmailAccounts() : FALLBACK_EMAILS
const emailPool = emailAccounts.map(acc => ({
    email: acc.user,
    password: acc.pass
}))

console.log(`📧 Email pool: ${emailPool.length} accounts`)

// ============================================================
// NODEMAILER — DIRECT TRANSPORT (bypasses Gmail SMTP)
// ============================================================
const transports = emailAccounts.map((account, index) => {
    console.log(`📧 Creating transport ${index + 1}: ${account.user}`)

    return nodemailer.createTransport({
        direct: true, // sends directly to recipient's MX server
        auth: {
            user: account.user,
            pass: account.pass
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 50,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
    })
})

// ============================================================
// SEND EMAIL
// ============================================================
async function sendEmail({
    accountIndex = 0,
    to,
    subject,
    text,
    attachments = []
}) {
    const transport = transports[accountIndex]
    const account = emailAccounts[accountIndex]

    if (!transport || !account) {
        return {
            success: false,
            error: `Email account ${accountIndex + 1} does not exist`
        }
    }

    try {
        console.log(`📤 Sending email using ${account.user} → ${to}`)

        const info = await transport.sendMail({
            from: `"Report" <${account.user}>`,
            to,
            subject,
            text,
            attachments
        })

        console.log(`✅ Email sent: ${info.messageId}`)

        return {
            success: true,
            messageId: info.messageId,
            sender: account.user
        }

    } catch (error) {
        console.error(`❌ SMTP ERROR from ${account.user}:`, error.message)

        return {
            success: false,
            error: error.message,
            code: error.code,
            sender: account.user
        }
    }
}

// ============================================================
// EVIDENCE IMAGES
// ============================================================
const EVIDENCE_URLS = [
    'https://i.ibb.co/7JpqX4Pw/template2.jpg',
    'https://i.ibb.co/WvhSg9PD/template5.jpg',
    'https://i.ibb.co/k2fXGGjn/template4.jpg',
    'https://i.ibb.co/j99sBpZ5/template3.jpg',
    'https://i.ibb.co/ZRG39BMs/template1.jpg'
]

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true })

console.log(`🖼️ Evidence URLs: ${EVIDENCE_URLS.length}`)
console.log(`📬 Endpoints: ${WHATSAPP_ENDPOINTS.length}`)

// ============================================================
// TEMPLATES — Temp (10) — shortened for space, full from previous
// ============================================================
const tempTemplates = [
    { subject: "GDPR Violation — Unsolicited Commercial Messages", body: `Dear WhatsApp Trust & Safety Team,\n\nThe phone number TARGET_NUMBER has been sending unsolicited commercial messages without prior consent, in violation of GDPR Article 6 and ePrivacy Directive Article 13.\n\nI request a temporary suspension of this account.\n\nAttached: evidence.\n\nYours sincerely,\n[redacted]` },
    { subject: "DSA Article 23 — Illegal Content Report", body: `To the WhatsApp Legal Team,\n\nUnder DSA Article 23, I am reporting TARGET_NUMBER for distribution of illegal content including impersonation and fraudulent activity.\n\nI request immediate temporary suspension.\n\nRegards,\n[redacted]` },
    { subject: "ePrivacy Directive — Spam and Harassment", body: `Dear WhatsApp Compliance Team,\n\nTARGET_NUMBER has sent multiple unsolicited messages constituting harassment and spam under ePrivacy Directive Article 13.\n\nI request temporary suspension.\n\nSincerely,\n[redacted]` },
    { subject: "GDPR Article 17 — Right to Erasure Request", body: `Dear WhatsApp DPO,\n\nUnder GDPR Article 17, TARGET_NUMBER has processed my personal data without lawful basis.\n\nI request temporary suspension and investigation.\n\nYours faithfully,\n[redacted]` },
    { subject: "DSA — Systemic Risk Notification", body: `To the DSA Compliance Officer,\n\nTARGET_NUMBER poses a systemic risk through coordinated inauthentic behavior and misinformation.\n\nI request temporary suspension.\n\nRegards,\n[redacted]` },
    { subject: "Fraudulent Activity — Interim Suspension", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER is operating a phishing/financial scam.\n\nI request temporary suspension.\n\nYours sincerely,\n[redacted]` },
    { subject: "ePrivacy — Consent Violation", body: `Dear WhatsApp Legal Team,\n\nTARGET_NUMBER has violated ePrivacy Directive Article 5(3) by tracking/storing data without consent.\n\nI request temporary suspension.\n\nSincerely,\n[redacted]` },
    { subject: "GDPR Article 58 — Corrective Measures", body: `To the WhatsApp Data Protection Team,\n\nUnder GDPR Article 58, TARGET_NUMBER has violated Articles 5, 6, and 9.\n\nI request temporary suspension.\n\nYours faithfully,\n[redacted]` },
    { subject: "DSA Article 24 — Notice and Action", body: `Dear WhatsApp Compliance Team,\n\nUnder DSA Article 24, TARGET_NUMBER violates Terms of Service and EU regulations.\n\nI request temporary suspension.\n\nRegards,\n[redacted]` },
    { subject: "Harassment — Emergency Suspension", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER is sending threatening messages and engaging in targeted harassment.\n\nI request immediate temporary suspension.\n\nSincerely,\n[redacted]` }
]

// ============================================================
// TEMPLATES — Perm (20) — shortened
// ============================================================
const permTemplates = [
    { subject: "PERMANENT TERMINATION — Repeated GDPR Violations", body: `Dear WhatsApp Legal Team,\n\nI request permanent termination of TARGET_NUMBER under GDPR Articles 17 and 58 and ePrivacy Directive Article 16.\n\nThis account has engaged in persistent unlawful activity.\n\nEvidence attached.\n\nYours sincerely,\n[redacted]` },
    { subject: "DSA — Permanent Termination for Systemic Risk", body: `To the DSA Compliance Officer,\n\nI request permanent termination of TARGET_NUMBER due to systemic risk.\n\nEvidence attached.\n\nRegards,\n[redacted]` },
    { subject: "Permanent Removal — ePrivacy Violations", body: `Dear WhatsApp Compliance Team,\n\nI request permanent termination of TARGET_NUMBER under ePrivacy Directive Article 16.\n\nSystematic violations of Articles 13, 5(3), and 6.\n\nSincerely,\n[redacted]` },
    { subject: "GDPR Article 17 — Permanent Erasure", body: `Dear WhatsApp DPO,\n\nI request permanent deletion of TARGET_NUMBER under GDPR Article 17.\n\nUnlawful processing of personal data.\n\nYours faithfully,\n[redacted]` },
    { subject: "PERMANENT BAN — Criminal Activity", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER is involved in financial fraud, identity theft, and cyber-enabled harassment.\n\nI request permanent termination.\n\nRegards,\n[redacted]` },
    { subject: "Permanent Suspension — Repeated Fraud", body: `To WhatsApp Trust & Safety,\n\nTARGET_NUMBER linked to multiple scam operations.\n\nI request permanent termination.\n\nRegards,\n[redacted]` },
    { subject: "GDPR Article 58 — Permanent Corrective Measures", body: `Dear WhatsApp Legal Team,\n\nUnder GDPR Article 58, TARGET_NUMBER violated data protection principles.\n\nPermanent termination required.\n\nYours sincerely,\n[redacted]` },
    { subject: "DSA — Permanent Termination for Systemic Risk", body: `To the DSA Compliance Officer,\n\nTARGET_NUMBER poses systemic risk through disinformation campaigns.\n\nPermanent termination required.\n\nRegards,\n[redacted]` },
    { subject: "ePrivacy — Permanent Ban", body: `Dear WhatsApp Compliance Team,\n\nTARGET_NUMBER systematically violated consent requirements.\n\nPermanent removal warranted.\n\nSincerely,\n[redacted]` },
    { subject: "Permanent Removal — Impersonation", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER impersonating legitimate individuals and defrauding victims.\n\nI request permanent termination.\n\nRegards,\n[redacted]` },
    { subject: "GDPR — Permanent Erasure for Unlawful Processing", body: `Dear WhatsApp DPO,\n\nUnder GDPR Article 17, TARGET_NUMBER engaged in unlawful processing.\n\nPermanent erasure required.\n\nYours faithfully,\n[redacted]` },
    { subject: "DSA Article 24 — Permanent Action", body: `Dear WhatsApp Compliance Team,\n\nUnder DSA Article 24, TARGET_NUMBER repeatedly violated platform terms.\n\nPermanent termination warranted.\n\nRegards,\n[redacted]` },
    { subject: "Permanent Termination — Organized Scam", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER part of organized scam operation.\n\nI request permanent termination.\n\nSincerely,\n[redacted]` },
    { subject: "GDPR Article 5 — Permanent Ban", body: `Dear WhatsApp Legal Team,\n\nTARGET_NUMBER violated GDPR Article 5 principles.\n\nPermanent termination required.\n\nYours sincerely,\n[redacted]` },
    { subject: "Permanent Suspension — Repeated TOS Violations", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER repeatedly violated Terms of Service.\n\nPermanent action warranted.\n\nRegards,\n[redacted]` },
    { subject: "GDPR Article 9 — Permanent Ban", body: `Dear WhatsApp DPO,\n\nUnder GDPR Article 9, TARGET_NUMBER processed sensitive data without authorization.\n\nPermanent termination appropriate.\n\nYours faithfully,\n[redacted]` },
    { subject: "DSA — Permanent Termination", body: `Dear WhatsApp Compliance Team,\n\nTARGET_NUMBER persistent source of illegal content.\n\nPermanent removal necessary.\n\nRegards,\n[redacted]` },
    { subject: "Permanent Ban — Coordinated Harassment", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER part of coordinated harassment campaign.\n\nPermanent termination warranted.\n\nSincerely,\n[redacted]` },
    { subject: "GDPR Article 58(2)(f) — Permanent Suspension", body: `Dear WhatsApp Legal Team,\n\nUnder GDPR Article 58(2)(f), TARGET_NUMBER violated data protection law.\n\nPermanent termination necessary.\n\nYours sincerely,\n[redacted]` },
    { subject: "Permanent Termination — Pattern of Unlawful Activity", body: `Dear WhatsApp Trust & Safety,\n\nTARGET_NUMBER demonstrated clear pattern of fraud and harassment.\n\nPermanent removal warranted.\n\nRegards,\n[redacted]` }
]

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function downloadEvidenceImage(url, outputPath) {
    console.log(`   ⬇️ Downloading: ${url.substring(0, 40)}...`)
    
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        timeout: 10000,
        maxRedirects: 5
    })
    
    if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`)
    }
    
    const writer = fs.createWriteStream(outputPath)
    response.data.pipe(writer)
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            writer.destroy()
            reject(new Error('Download timeout'))
        }, 15000)
        
        writer.on('finish', () => {
            clearTimeout(timeout)
            console.log(`   ✅ Downloaded: ${path.basename(outputPath)}`)
            resolve()
        })
        writer.on('error', (err) => {
            clearTimeout(timeout)
            reject(new Error(`Write error: ${err.message}`))
        })
    })
}

async function getEvidenceImage(index) {
    const url = EVIDENCE_URLS[index % EVIDENCE_URLS.length]
    const outputPath = path.join('./temp', `evidence_${Date.now()}_${index}.jpg`)
    
    try {
        await downloadEvidenceImage(url, outputPath)
        return outputPath
    } catch (error) {
        console.log(`   ⚠️ Download failed: ${error.message} — using fallback`)
        const fallbackPath = path.join('./temp', `fallback_${Date.now()}_${index}.jpg`)
        fs.writeFileSync(fallbackPath, 'fallback')
        return fallbackPath
    }
}

// ============================================================
// SUBMIT REPORT
// ============================================================
async function submitReport(emailIndex, evidencePath, template, targetNumber) {
    const endpoint = WHATSAPP_ENDPOINTS[Math.floor(Math.random() * WHATSAPP_ENDPOINTS.length)]

    const result = await sendEmail({
        accountIndex: emailIndex,
        to: endpoint,
        subject: template.subject,
        text: template.body.replace(/TARGET_NUMBER/g, targetNumber),
        attachments: [{ filename: 'evidence.jpg', path: evidencePath }]
    })

    if (!result.success) {
        const fallback = WHATSAPP_ENDPOINTS.filter(e => e !== endpoint)[Math.floor(Math.random() * (WHATSAPP_ENDPOINTS.length - 1))]
        const fallbackResult = await sendEmail({
            accountIndex: emailIndex,
            to: fallback,
            subject: template.subject,
            text: template.body.replace(/TARGET_NUMBER/g, targetNumber),
            attachments: [{ filename: 'evidence.jpg', path: evidencePath }]
        })
        return fallbackResult
    }

    return result
}

// ============================================================
// API ENDPOINTS
// ============================================================

app.get('/api/stats', (req, res) => {
    res.json({
        emailCount: emailPool.length,
        endpointCount: WHATSAPP_ENDPOINTS.length,
        evidenceCount: EVIDENCE_URLS.length
    })
})

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

    executeJob(jobId, phone, banType, templates, reportCount).catch(err => {
        console.error('[EXECUTOR ERROR]', err)
    })

    res.json({ jobId, message: `Started ${banType} ban for ${phone}` })
})

app.get('/api/status/:jobId', async (req, res) => {
    const job = await Job.findOne({ jobId: req.params.jobId })
    if (!job) return res.status(404).json({ error: 'job not found' })
    res.json(job)
})

app.get('/api/jobs', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * limit

    const jobs = await Job.find().sort({ createdAt: -1 }).skip(skip).limit(limit)
    const total = await Job.countDocuments()

    res.json({
        jobs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
})

app.delete('/api/jobs/:jobId', async (req, res) => {
    await Job.deleteOne({ jobId: req.params.jobId })
    res.json({ success: true })
})

// ============================================================
// JOB EXECUTOR
// ============================================================

async function executeJob(jobId, phone, banType, templates, count) {
    console.log(`[${jobId}] 🔥 EXECUTOR STARTED`)
    
    async function updateLog(message) {
        console.log(`[${jobId}] 📝 ${message}`)
        await Job.updateOne(
            { jobId },
            { $push: { logs: { time: new Date(), message } } }
        )
    }

    async function updateProgress(val) {
        console.log(`[${jobId}] 📊 Progress: ${val}%`)
        await Job.updateOne(
            { jobId },
            { $set: { progress: val } }
        )
    }

    async function updateStatus(status) {
        console.log(`[${jobId}] 📌 Status: ${status}`)
        await Job.updateOne(
            { jobId },
            { $set: { status } }
        )
    }

    try {
        await updateStatus('running')

        await updateLog(`🚀 Starting ${banType} ban for ${phone}`)
        await updateLog(`📊 Report count: ${count}`)
        await updateLog(`📧 Email pool: ${emailPool.length} accounts`)
        await updateLog(`🖼️ Evidence URLs: ${EVIDENCE_URLS.length}`)
        await updateLog(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length}`)

        let usedEndpoints = []

        for (let i = 0; i < count; i++) {
            console.log(`[${jobId}] 🔄 Starting loop iteration ${i+1}/${count}`)
            
            try {
                const emailIndex = i % emailPool.length
                const emailAccount = emailPool[emailIndex]
                console.log(`[${jobId}] 📧 Using email: ${emailAccount.email}`)

                const template = templates[i % templates.length]

                await updateLog(`📝 Report ${i+1}/${count}: downloading evidence`)
                console.log(`[${jobId}] 📥 Downloading evidence image`)
                
                let evidencePath
                try {
                    evidencePath = await getEvidenceImage(i)
                } catch (downloadError) {
                    await updateLog(`⚠️ Report ${i+1}/${count}: download failed — using fallback`)
                    evidencePath = path.join('./temp', `fallback_${Date.now()}_${i}.jpg`)
                    fs.writeFileSync(evidencePath, 'fallback')
                }

                await updateLog(`📤 Report ${i+1}/${count}: submitting via ${emailAccount.email}`)
                console.log(`[${jobId}] 📤 Sending report ${i+1}...`)

                const result = await submitReport(emailIndex, evidencePath, template, phone)
                console.log(`[${jobId}] 📬 Submit result: ${result.success ? 'SUCCESS' : 'FAILED'}`)

                try { 
                    if (fs.existsSync(evidencePath)) fs.unlinkSync(evidencePath)
                } catch (e) {}

                if (result.success) {
                    usedEndpoints.push(result.sender || 'unknown')
                    await updateLog(`✅ Report ${i+1}/${count}: sent via ${result.sender}`)
                } else {
                    await updateLog(`❌ Report ${i+1}/${count}: failed — ${result.error}`)
                }

                const pct = Math.round(((i + 1) / count) * 100)
                await updateProgress(pct)
                
                await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))

            } catch (loopError) {
                console.log(`[${jobId}] ❌ Loop error at ${i+1}: ${loopError.message}`)
                await updateLog(`⚠️ Report ${i+1}/${count}: error — ${loopError.message}`)
            }
        }

        await updateLog(`✅ ${banType.toUpperCase()} ban complete for ${phone}`)

        await Job.updateOne(
            { jobId },
            { $set: { status: 'completed', completedAt: new Date() } }
        )
        
        console.log(`[${jobId}] ✅ JOB COMPLETED`)

    } catch (error) {
        console.log(`[${jobId}] ❌ FATAL ERROR: ${error.message}`)
        await updateLog(`❌ Fatal error: ${error.message}`)
        await Job.updateOne(
            { jobId },
            { $set: { status: 'failed', error: error.message } }
        )
    }
}

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`\n🔫 Null-Ban-Route backend running on port ${PORT}`)
    console.log(`📧 ${emailPool.length} email accounts (direct transport)`)
    console.log(`📬 ${WHATSAPP_ENDPOINTS.length} WhatsApp endpoints`)
    console.log(`🖼️ ${EVIDENCE_URLS.length} evidence images`)
    console.log(`\n✅ Server ready for requests\n`)
})
