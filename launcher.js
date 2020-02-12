const https = require('https')

exports.test = (host) => {
    return https.get({
        host: host
    }, (res) => {
        let chunks = []
        res.on('error', () => { console.log('oulala ça marche pas :\'( ') })
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
            console.log('DONE', Buffer.concat(chunks).toString('utf8'))
        })
    }).on('error', (err) => {
        console.error('error', err)
    }).end()
}

exports.pasTest = () => { console.log('ah ah ah') }