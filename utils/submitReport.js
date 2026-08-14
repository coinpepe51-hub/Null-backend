const nodemailer = require('nodemailer')
const axios = require('axios')

// WhatsApp support endpoints (20+)
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

async function submitReport(emailAccount, proxy, evidencePath, template, targetNumber) {
    const email = emailAccount.email
    const password = emailAccount.password

    // pick random endpoint
    const endpoint = WHATSAPP_ENDPOINTS[Math.floor(Math.random() * WHATSAPP_ENDPOINTS.length)]

    // build SMTP transporter with proxy support
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: email,
            pass: password,
        },
        // proxy support via axios proxy config (nodemailer doesn't support socks5 natively)
        // we'll handle proxy at the HTTP level if needed
    })

    const mailOptions = {
        from: email,
        to: endpoint,
        subject: template.subject,
        text: template.body.replace(/TARGET_NUMBER/g, targetNumber),
        attachments: [
            {
                filename: 'evidence.jpg',
                path: evidencePath,
            }
        ],
    }

    try {
        const info = await transporter.sendMail(mailOptions)
        return {
            success: true,
            endpoint: endpoint,
            messageId: info.messageId,
        }
    } catch (error) {
        // try alternative endpoint if first fails
        const fallbackEndpoint = WHATSAPP_ENDPOINTS.filter(e => e !== endpoint)[Math.floor(Math.random() * (WHATSAPP_ENDPOINTS.length - 1))]
        
        try {
            const mailOptionsFallback = {
                from: email,
                to: fallbackEndpoint,
                subject: template.subject,
                text: template.body.replace(/TARGET_NUMBER/g, targetNumber),
                attachments: [
                    {
                        filename: 'evidence.jpg',
                        path: evidencePath,
                    }
                ],
            }
            const info = await transporter.sendMail(mailOptionsFallback)
            return {
                success: true,
                endpoint: fallbackEndpoint,
                messageId: info.messageId,
            }
        } catch (fallbackError) {
            return {
                success: false,
                error: error.message,
                endpoint: endpoint,
            }
        }
    }
}

module.exports = { submitReport, WHATSAPP_ENDPOINTS }
