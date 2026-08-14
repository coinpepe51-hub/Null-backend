const axios = require('axios')

// test a single proxy
async function testProxy(proxy) {
    const url = 'https://www.whatsapp.com'
    const protocol = proxy.protocol === 'socks5' ? 'socks5' : 'http'
    
    try {
        const response = await axios.get(url, {
            proxy: {
                host: proxy.host,
                port: proxy.port,
                protocol: protocol
            },
            timeout: 5000
        })
        return response.status === 200
    } catch (error) {
        return false
    }
}

// get a working proxy from the pool
async function getWorkingProxy(proxyPool) {
    // shuffle pool
    const shuffled = [...proxyPool].sort(() => Math.random() - 0.5)
    
    for (const proxy of shuffled) {
        const working = await testProxy(proxy)
        if (working) {
            return proxy
        }
    }
    
    // fallback — return first proxy anyway (try without proxy)
    return proxyPool[0]
}

module.exports = { testProxy, getWorkingProxy }
