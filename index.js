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
// EMAIL POOL
// ============================================================
const emailPool = [
    {"email": "sin146744@gmail.com", "password": "quyjgdcgzfocrkaj"},
    {"email": "heisweaver253@gmail.com", "password": "xzrtrswvvgzepkyf"},
    {"email": "jinwokmonarch@gmail.com", "password": "zwvnzbbdqfotcycp"},
    {"email": "kaiwilliams149@gmail.com", "password": "naegfrdusayolrsd"},
    {"email": "vicentehenry143@gmail.com", "password": "ifeunqzqbaztrmju"},
    {"email": "kaiwilliams930@gmail.com", "password": "cwaapuwovrlrodum"},
    {"email": "vicentehenry710@gmail.com", "password": "mdccbylzzapfzcmn"},
    {"email": "vicentehenry656@gmail.com", "password": "hmrpkjudaifebmgv"}
]

// ============================================================
// PROXY POOL (NOT USED — direct connection only)
// ============================================================
// proxy checking was causing hangs — we skip it entirely

// ============================================================
// EVIDENCE IMAGES — ImgBB URLs (DIRECT LINKS)
// ============================================================
const EVIDENCE_URLS = [
    'https://i.ibb.co/7JpqX4Pw/template2.jpg',
    'https://i.ibb.co/WvhSg9PD/template5.jpg',
    'https://i.ibb.co/k2fXGGjn/template4.jpg',
    'https://i.ibb.co/j99sBpZ5/template3.jpg',
    'https://i.ibb.co/ZRG39BMs/template1.jpg'
]

// Ensure temp directory exists
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true })

console.log(`📧 Email pool: ${emailPool.length} accounts`)
console.log(`🖼️ Evidence URLs: ${EVIDENCE_URLS.length}`)
console.log(`📬 Endpoints: ${WHATSAPP_ENDPOINTS.length}`)

// ============================================================
// TEMPLATES — Temp (10)
// ============================================================
const tempTemplates = [
    {
        subject: "GDPR Violation — Unsolicited Commercial Messages",
        body: `Dear WhatsApp Trust & Safety Team,

I am writing to formally report a violation of the EU General Data Protection Regulation (GDPR) and the ePrivacy Directive (2002/58/EC).

The phone number in question is: TARGET_NUMBER

This number has been sending unsolicited commercial messages without prior consent, in clear violation of:
- GDPR Article 6 (Lawfulness of processing)
- GDPR Article 7 (Conditions for consent)
- ePrivacy Directive Article 13 (Unsolicited communications)

I have attached screenshots showing these unsolicited messages.

I request a temporary suspension of this account pending a full investigation.

Yours sincerely,
[redacted]`
    },
    {
        subject: "DSA Article 23 — Illegal Content Report",
        body: `To the WhatsApp Legal Team,

Under the EU Digital Services Act (DSA) Article 23, I am reporting account TARGET_NUMBER for the distribution of illegal content.

The account has been observed engaging in:
- Impersonation
- Fraudulent activity
- Violation of platform terms of service

Evidence is attached.

I request immediate temporary suspension under DSA Article 23(3).

Regards,
[redacted]`
    },
    {
        subject: "ePrivacy Directive — Spam and Harassment",
        body: `Dear WhatsApp Compliance Team,

I am reporting TARGET_NUMBER for repeated violations of the ePrivacy Directive.

This account has sent multiple unsolicited messages over the past 48 hours, constituting harassment and spam.

Under ePrivacy Directive Article 13, such communications require prior consent — none was given.

I request temporary suspension effective immediately.

Attached: screenshots of the communications.

Sincerely,
[redacted]`
    },
    {
        subject: "GDPR Article 17 — Right to Erasure Request",
        body: `Dear WhatsApp Data Protection Officer,

This is a formal request under GDPR Article 17 (Right to Erasure).

The account TARGET_NUMBER has been processing my personal data without lawful basis.

I request that you:
1. Suspend the account temporarily
2. Investigate the data processing
3. Erase any personal data unlawfully processed

Evidence of unauthorized data use is attached.

Yours faithfully,
[redacted]`
    },
    {
        subject: "DSA — Systemic Risk Notification",
        body: `To the DSA Compliance Officer,

I am notifying WhatsApp of a systemic risk posed by account TARGET_NUMBER under the Digital Services Act.

This account is engaged in:
- Coordinated inauthentic behavior
- Misinformation dissemination
- Violation of community guidelines

I request temporary suspension to mitigate the risk.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Fraudulent Activity — Interim Suspension Request",
        body: `Dear WhatsApp Trust & Safety,

I am reporting TARGET_NUMBER for suspected fraudulent activity.

The account appears to be operating a:
- Phishing scheme
- Financial scam
- Impersonation of legitimate entities

Under your terms of service, I request a temporary suspension while the case is reviewed.

Attached: evidence of the fraudulent activity.

Yours sincerely,
[redacted]`
    },
    {
        subject: "ePrivacy — Consent Violation Report",
        body: `Dear WhatsApp Legal Team,

Under ePrivacy Directive Article 5(3), I am reporting TARGET_NUMBER for storing or accessing information on user devices without consent.

The account has been:
- Tracking user interactions
- Sending unsolicited marketing
- Operating without prior opt-in consent

I request temporary suspension.

Evidence attached.

Sincerely,
[redacted]`
    },
    {
        subject: "GDPR Article 58 — Corrective Measures Request",
        body: `To the WhatsApp Data Protection Team,

Under GDPR Article 58, I am requesting corrective measures against account TARGET_NUMBER.

The account has been processing personal data in violation of:
- GDPR Article 5 (Principles)
- GDPR Article 6 (Lawfulness)
- GDPR Article 9 (Special categories)

I request immediate temporary suspension under Article 58(2)(f).

Evidence of violations attached.

Yours faithfully,
[redacted]`
    },
    {
        subject: "DSA Article 24 — Notice and Action",
        body: `Dear WhatsApp Compliance Team,

I am submitting a Notice and Action request under DSA Article 24.

Account TARGET_NUMBER has been engaging in conduct that violates:
- Your Terms of Service
- DSA provisions on illegal content
- EU consumer protection laws

I request temporary suspension within 24 hours.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Harassment — Emergency Suspension",
        body: `Dear WhatsApp Trust & Safety,

This is an emergency report regarding account TARGET_NUMBER.

The account has been:
- Sending threatening messages
- Engaging in targeted harassment
- Violating WhatsApp's anti-harassment policy

Given the nature of the conduct, I request immediate temporary suspension.

Attached: evidence of the harassment.

Sincerely,
[redacted]`
    }
]

// ============================================================
// TEMPLATES — Perm (20)
// ============================================================
const permTemplates = [
    {
        subject: "PERMANENT TERMINATION — Repeated GDPR Violations",
        body: `Dear WhatsApp Legal & Compliance Team,

This is a formal request for permanent account termination under:
- GDPR Article 17 (Right to erasure)
- GDPR Article 58 (Corrective powers)
- ePrivacy Directive Article 16

Account TARGET_NUMBER has engaged in persistent, unlawful activity including:
- Systematic unsolicited marketing
- Repeated violations of data protection principles
- Failure to respond to cessation requests

This is a pattern of behavior that warrants permanent removal.

I have attached a comprehensive evidence package.

Yours sincerely,
[redacted]`
    },
    {
        subject: "DSA Article 23 — Systemic Illegal Content — Permanent Action",
        body: `To the WhatsApp Legal Team,

Under DSA Article 23, I am requesting permanent account termination for TARGET_NUMBER.

This account has been repeatedly observed distributing illegal content including:
- Fraudulent financial schemes
- Identity theft
- Coordinated disinformation campaigns

The pattern of behavior indicates this is not a single violation but a systemic issue requiring permanent action.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Permanent Removal — ePrivacy Directive Violations",
        body: `Dear WhatsApp Compliance Team,

I am requesting permanent account termination for TARGET_NUMBER under ePrivacy Directive Article 16.

This account has engaged in systematic violation of:
- Article 13 (Unsolicited communications)
- Article 5(3) (Tracking without consent)
- Article 6 (Confidentiality of communications)

The volume and persistence of violations warrant permanent removal.

Attached: comprehensive evidence.

Sincerely,
[redacted]`
    },
    {
        subject: "GDPR Article 17 — Permanent Erasure Request",
        body: `Dear WhatsApp Data Protection Officer,

Under GDPR Article 17 (Right to Erasure), I am requesting permanent deletion of account TARGET_NUMBER.

The account has unlawfully processed personal data on multiple occasions, including:
- Collecting data without consent
- Sharing data with third parties
- Refusing to comply with data subject requests

Given the repeated nature, permanent erasure is the appropriate remedy.

Yours faithfully,
[redacted]`
    },
    {
        subject: "PERMANENT BAN — Criminal Activity Report",
        body: `Dear WhatsApp Trust & Safety,

This is a formal report of criminal activity by account TARGET_NUMBER.

Activities observed include:
- Financial fraud
- Identity theft
- Distribution of malicious links
- Cyber-enabled harassment

I request permanent account termination and referral to appropriate authorities.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Permanent Suspension — Repeated Fraudulent Activity",
        body: `To WhatsApp Trust & Safety,

I am requesting permanent termination for TARGET_NUMBER due to repeated fraudulent activity.

This account has been linked to multiple scam operations targeting vulnerable individuals.

The pattern of behavior demonstrates a deliberate and ongoing disregard for platform rules.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "GDPR Article 58 — Permanent Corrective Measures",
        body: `Dear WhatsApp Legal Team,

Under GDPR Article 58, I request permanent corrective measures against TARGET_NUMBER.

The account has consistently violated data protection principles including:
- Lawfulness, fairness, and transparency
- Purpose limitation
- Data minimization

Permanent termination is the only appropriate remedy.

Yours sincerely,
[redacted]`
    },
    {
        subject: "DSA — Permanent Termination for Systemic Risk",
        body: `To the DSA Compliance Officer,

Under the Digital Services Act, I request permanent termination of TARGET_NUMBER.

This account poses a systemic risk to platform integrity through:
- Coordinated inauthentic behavior
- Disinformation campaigns
- Repeated terms of service violations

I have attached comprehensive evidence.

Regards,
[redacted]`
    },
    {
        subject: "ePrivacy — Permanent Ban for Consent Violations",
        body: `Dear WhatsApp Compliance Team,

I request permanent ban for TARGET_NUMBER under ePrivacy Directive Article 16.

This account has systematically violated consent requirements, including:
- Sending unsolicited communications
- Tracking without consent
- Refusing to honor opt-out requests

Permanent removal is warranted.

Sincerely,
[redacted]`
    },
    {
        subject: "Permanent Removal — Impersonation and Identity Theft",
        body: `Dear WhatsApp Trust & Safety,

I am requesting permanent removal of TARGET_NUMBER for impersonation and identity theft.

This account has been:
- Impersonating legitimate individuals
- Soliciting personal information
- Defrauding victims

I request immediate permanent termination.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "GDPR — Permanent Erasure for Unlawful Processing",
        body: `Dear WhatsApp Data Protection Officer,

Under GDPR Article 17, I request permanent erasure of TARGET_NUMBER.

The account has engaged in unlawful processing of personal data without legal basis.

This includes:
- Processing sensitive data
- Sharing data without consent
- Refusing data subject access requests

Yours faithfully,
[redacted]`
    },
    {
        subject: "DSA Article 24 — Permanent Action Request",
        body: `Dear WhatsApp Compliance Team,

Under DSA Article 24, I request permanent action against TARGET_NUMBER.

This account has repeatedly violated platform terms and EU regulations.

The violations are severe and persistent, warranting permanent termination.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Permanent Termination — Organized Scam Operation",
        body: `Dear WhatsApp Trust & Safety,

I am reporting TARGET_NUMBER as part of an organized scam operation.

Activities include:
- Financial fraud schemes
- Phishing campaigns
- Victim targeting

I request permanent termination.

Evidence attached.

Sincerely,
[redacted]`
    },
    {
        subject: "GDPR Article 5 — Permanent Ban for Principle Violations",
        body: `Dear WhatsApp Legal Team,

I request permanent ban for TARGET_NUMBER under GDPR Article 5.

The account has violated core data protection principles including:
- Lawfulness
- Fairness
- Transparency
- Accountability

Permanent termination is required.

Yours sincerely,
[redacted]`
    },
    {
        subject: "Permanent Suspension — Repeated Terms of Service Violations",
        body: `Dear WhatsApp Trust & Safety,

I request permanent suspension of TARGET_NUMBER.

This account has repeatedly violated WhatsApp's Terms of Service including:
- Harassment
- Spam
- Impersonation

The pattern is clear and warrants permanent action.

Regards,
[redacted]`
    },
    {
        subject: "GDPR Article 9 — Permanent Ban for Sensitive Data Processing",
        body: `Dear WhatsApp Data Protection Officer,

Under GDPR Article 9, I request permanent ban for TARGET_NUMBER.

The account has processed special categories of personal data without authorization, including:
- Health data
- Financial information
- Biometric data

Permanent termination is appropriate.

Yours faithfully,
[redacted]`
    },
    {
        subject: "DSA — Permanent Termination for Illegal Content Distribution",
        body: `Dear WhatsApp Compliance Team,

Under the Digital Services Act, I request permanent termination for TARGET_NUMBER.

This account has been a persistent source of illegal content including:
- Fraudulent schemes
- Harmful misinformation
- Unlawful commercial activity

Permanent removal is necessary.

Evidence attached.

Regards,
[redacted]`
    },
    {
        subject: "Permanent Ban — Coordinated Harassment Campaign",
        body: `Dear WhatsApp Trust & Safety,

I request permanent ban for TARGET_NUMBER.

This account has been part of a coordinated harassment campaign targeting multiple individuals.

The behavior includes:
- Threats
- Abuse
- Repeated unwanted contact

Permanent termination is warranted.

Sincerely,
[redacted]`
    },
    {
        subject: "GDPR Article 58(2)(f) — Permanent Suspension Request",
        body: `Dear WhatsApp Legal Team,

Under GDPR Article 58(2)(f), I request permanent suspension of TARGET_NUMBER.

The account has engaged in persistent violations of data protection law.

Corrective measures including permanent termination are necessary.

Evidence attached.

Yours sincerely,
[redacted]`
    },
    {
        subject: "Permanent Termination — Pattern of Unlawful Activity",
        body: `Dear WhatsApp Trust & Safety Team,

I am requesting permanent termination for TARGET_NUMBER.

This account has demonstrated a clear pattern of unlawful activity including:
- Fraud
- Harassment
- Terms of service violations

The cumulative evidence supports permanent removal.

I have attached comprehensive documentation.

Regards,
[redacted]`
    }
]

// ============================================================
// UTILITY FUNCTIONS — NO PROXY CHECKING
// ============================================================

// Download image from ImgBB URL with timeout
async function downloadEvidenceImage(url, outputPath) {
    try {
        console.log(`   ⬇️ Downloading: ${url.substring(0, 40)}...`)
        
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 10000, // 10 second timeout
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
    } catch (error) {
        throw new Error(`Download failed: ${error.message}`)
    }
}

// Get evidence image with fallback
async function getEvidenceImage(index) {
    const url = EVIDENCE_URLS[index % EVIDENCE_URLS.length]
    const outputPath = path.join('./temp', `evidence_${Date.now()}_${index}.jpg`)
    
    try {
        await downloadEvidenceImage(url, outputPath)
        return outputPath
    } catch (error) {
        console.log(`   ⚠️ Download failed: ${error.message} — using fallback`)
        // Create a small fallback file
        const fallbackPath = path.join('./temp', `fallback_${Date.now()}_${index}.jpg`)
        fs.writeFileSync(fallbackPath, 'fallback image content')
        return fallbackPath
    }
}

// submit report via SMTP
async function submitReport(emailAccount, evidencePath, template, targetNumber) {
    const endpoint = WHATSAPP_ENDPOINTS[Math.floor(Math.random() * WHATSAPP_ENDPOINTS.length)]

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: emailAccount.email,
            pass: emailAccount.password,
        },
    })

    const mailOptions = {
        from: emailAccount.email,
        to: endpoint,
        subject: template.subject,
        text: template.body.replace(/TARGET_NUMBER/g, targetNumber),
        attachments: [{ filename: 'evidence.jpg', path: evidencePath }],
    }

    try {
        const info = await transporter.sendMail(mailOptions)
        return { success: true, endpoint, messageId: info.messageId }
    } catch (error) {
        // try fallback endpoint
        const fallback = WHATSAPP_ENDPOINTS.filter(e => e !== endpoint)[Math.floor(Math.random() * (WHATSAPP_ENDPOINTS.length - 1))]
        try {
            const info = await transporter.sendMail({
                ...mailOptions,
                to: fallback
            })
            return { success: true, endpoint: fallback, messageId: info.messageId }
        } catch (e2) {
            return { success: false, error: error.message, endpoint }
        }
    }
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

    // run in background
    executeJob(jobId, phone, banType, templates, reportCount).catch(err => {
        console.error('Job execution error:', err)
        Job.findOneAndUpdate({ jobId }, { 
            status: 'failed', 
            error: err.message 
        }).then(() => {})
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
    
    const job = await Job.findOne({ jobId })
    if (!job) {
        console.log(`[${jobId}] ❌ Job not found in database`)
        return
    }

    async function updateLog(message) {
        console.log(`[${jobId}] 📝 ${message}`)
        job.logs.push({ time: new Date(), message })
        await job.save()
    }

    async function updateProgress(val) {
        console.log(`[${jobId}] 📊 Progress: ${val}%`)
        job.progress = val
        await job.save()
    }

    try {
        console.log(`[${jobId}] 📌 Setting status to running`)
        job.status = 'running'
        await job.save()

        await updateLog(`🚀 Starting ${banType} ban for ${phone}`)
        await updateLog(`📊 Report count: ${count}`)
        await updateLog(`📧 Email pool: ${emailPool.length} accounts`)
        await updateLog(`🖼️ Evidence URLs: ${EVIDENCE_URLS.length}`)
        await updateLog(`📬 WhatsApp endpoints: ${WHATSAPP_ENDPOINTS.length}`)

        let usedEndpoints = []

        for (let i = 0; i < count; i++) {
            console.log(`[${jobId}] 🔄 Starting loop iteration ${i+1}/${count}`)
            
            try {
                const emailAccount = emailPool[i % emailPool.length]
                console.log(`[${jobId}] 📧 Using email: ${emailAccount.email}`)

                const template = templates[i % templates.length]
                console.log(`[${jobId}] 📄 Using template: ${template.subject.substring(0, 30)}...`)

                // Download evidence image from ImgBB
                await updateLog(`📝 Report ${i+1}/${count}: downloading evidence image`)
                console.log(`[${jobId}] 📥 Downloading evidence image for report ${i+1}`)
                
                let evidencePath
                try {
                    evidencePath = await getEvidenceImage(i)
                    console.log(`[${jobId}] ✅ Evidence downloaded to: ${evidencePath}`)
                } catch (downloadError) {
                    console.log(`[${jobId}] ❌ Download error: ${downloadError.message}`)
                    await updateLog(`⚠️ Report ${i+1}/${count}: download failed — using fallback`)
                    evidencePath = path.join('./temp', `fallback_${Date.now()}_${i}.jpg`)
                    fs.writeFileSync(evidencePath, 'fallback')
                }

                await updateLog(`📤 Report ${i+1}/${count}: submitting via ${emailAccount.email}`)
                console.log(`[${jobId}] 📤 Sending report ${i+1}...`)

                const result = await submitReport(emailAccount, evidencePath, template, phone)
                console.log(`[${jobId}] 📬 Submit result: ${result.success ? 'SUCCESS' : 'FAILED'}`)

                // Clean up temp file
                try { 
                    if (fs.existsSync(evidencePath)) {
                        fs.unlinkSync(evidencePath)
                        console.log(`[${jobId}] 🗑️ Deleted temp file`)
                    }
                } catch (e) {
                    console.log(`[${jobId}] ⚠️ Could not delete temp file: ${e.message}`)
                }

                if (result.success) {
                    usedEndpoints.push(result.endpoint)
                    await updateLog(`✅ Report ${i+1}/${count}: sent via ${result.endpoint}`)
                } else {
                    await updateLog(`❌ Report ${i+1}/${count}: failed — ${result.error}`)
                }

                const pct = Math.round(((i + 1) / count) * 100)
                await updateProgress(pct)
                
                console.log(`[${jobId}] ⏳ Waiting before next report...`)
                await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))

            } catch (loopError) {
                console.log(`[${jobId}] ❌ Loop error at ${i+1}: ${loopError.message}`)
                console.log(`[${jobId}] 🔍 Stack: ${loopError.stack}`)
                await updateLog(`⚠️ Report ${i+1}/${count}: error — ${loopError.message}`)
            }
        }

        const uniqueEndpoints = [...new Set(usedEndpoints)]
        job.usedEndpoints = uniqueEndpoints
        await updateLog(`✅ ${banType.toUpperCase()} ban complete for ${phone}`)
        await updateLog(`📊 Used ${usedEndpoints.length} reports across ${uniqueEndpoints.length} unique endpoints`)

        job.status = 'completed'
        job.completedAt = new Date()
        await job.save()
        
        console.log(`[${jobId}] ✅ JOB COMPLETED SUCCESSFULLY`)

    } catch (error) {
        console.log(`[${jobId}] ❌ FATAL ERROR: ${error.message}`)
        console.log(`[${jobId}] 🔍 Stack: ${error.stack}`)
        await updateLog(`❌ Fatal error: ${error.message}`)
        job.status = 'failed'
        job.error = error.message
        await job.save()
    }
}

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`\n🔫 Null-Ban-Route backend running on port ${PORT}`)
    console.log(`📧 ${emailPool.length} email accounts`)
    console.log(`📬 ${WHATSAPP_ENDPOINTS.length} WhatsApp endpoints`)
    console.log(`🖼️ ${EVIDENCE_URLS.length} evidence images`)
    console.log(`\n✅ Server ready for requests\n`)
})
