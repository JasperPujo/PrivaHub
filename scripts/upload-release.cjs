const fs = require('fs')
const path = require('path')
const https = require('https')

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8')
const tokenMatch = envContent.match(/^GITHUB_TOKEN=(.+)$/m)
const token = tokenMatch ? tokenMatch[1].trim() : ''
const releaseId = 354247226
const filePath = path.join(__dirname, '..', 'release', 'PrivaHub-1.1.0-win-x64.zip')
const fileName = 'PrivaHub-1.1.0-win-x64.zip'

const fileStats = fs.statSync(filePath)
console.log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`)

const fileBuffer = fs.readFileSync(filePath)

const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
const header = Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
  `Content-Type: application/zip\r\n\r\n`
)
const footer = Buffer.from(`\r\n--${boundary}--\r\n`)

const body = Buffer.concat([header, fileBuffer, footer])

const options = {
  hostname: 'uploads.github.com',
  path: `/repos/JasperPujo/PrivaHub/releases/${releaseId}/assets?name=${fileName}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
}

console.log('Uploading...')

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      if (json.browser_download_url) {
        console.log(`Success! Download URL: ${json.browser_download_url}`)
      } else {
        console.error('Response:', data)
      }
    } catch {
      console.error('Response:', data)
    }
  })
})

req.on('error', (err) => {
  console.error('Error:', err.message)
})

req.write(body)
req.end()
