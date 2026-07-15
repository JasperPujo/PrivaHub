const { createWriteStream, readFileSync, statSync, readdirSync, mkdirSync, existsSync } = require('fs')
const path = require('path')
const { zip } = require('zip-a-folder')

const source = path.join(__dirname, '..', 'release', 'win-unpacked')
const target = path.join(__dirname, '..', 'release', 'PrivaHub-1.1.0-win-x64.zip')

;(async () => {
  try {
    console.log('Zipping...')
    await zip(source, target)
    const stats = statSync(target)
    console.log(`Done! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
})()
