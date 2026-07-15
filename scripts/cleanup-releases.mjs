/**
 * GitHub Release 清理脚本
 * 只保留最新的 N 个 release（默认 3 个），删除其余的 release 及其 tag
 *
 * 使用方法：
 *   node scripts/cleanup-releases.mjs
 *   node scripts/cleanup-releases.mjs --keep 5      # 保留 5 个
 *   node scripts/cleanup-releases.mjs --dry-run     # 只预览不删除
 *
 * 需要设置环境变量 GITHUB_TOKEN（个人访问令牌，需有 repo 权限）
 * 或在 .env 文件中配置 GITHUB_TOKEN=xxx
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从 package.json 读取仓库信息
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))
const publish = pkg.build?.publish
const owner = publish?.owner || 'JasperPujo'
const repo = publish?.repo || 'PrivaHub'

// 解析参数
const args = process.argv.slice(2)
const keepCount = parseInt(args.find(a => a.startsWith('--keep='))?.split('=')[1] || '3', 10)
const dryRun = args.includes('--dry-run')

// 获取 token
let token = process.env.GITHUB_TOKEN

// 尝试从 .env 文件读取
if (!token) {
  const envPath = path.join(__dirname, '../.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const match = envContent.match(/^GITHUB_TOKEN=(.+)$/m)
    if (match) token = match[1].trim()
  }
}

if (!token) {
  console.error('❌ 未找到 GITHUB_TOKEN')
  console.error('请设置环境变量 GITHUB_TOKEN 或在 .env 文件中配置')
  console.error('获取 token: https://github.com/settings/tokens  (勾选 repo 权限)')
  process.exit(1)
}

const apiBase = 'https://api.github.com'
const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'PrivaHub-Cleanup'
}

async function fetchAllReleases() {
  const releases = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${apiBase}/repos/${owner}/${repo}/releases?per_page=100&page=${page}`,
      { headers }
    )
    if (!res.ok) {
      console.error(`❌ 获取 release 列表失败: ${res.status} ${res.statusText}`)
      process.exit(1)
    }
    const data = await res.json()
    if (data.length === 0) break
    releases.push(...data)
    page++
  }
  return releases
}

async function deleteRelease(release) {
  // 1. 删除 release
  const res = await fetch(
    `${apiBase}/repos/${owner}/${repo}/releases/${release.id}`,
    { method: 'DELETE', headers }
  )
  if (!res.ok) {
    console.warn(`  ⚠️  删除 release ${release.tag_name} 失败: ${res.status}`)
    return false
  }

  // 2. 删除对应的 tag
  const tagRes = await fetch(
    `${apiBase}/repos/${owner}/${repo}/git/refs/tags/${release.tag_name}`,
    { method: 'DELETE', headers }
  )
  if (!tagRes.ok) {
    console.warn(`  ⚠️  删除 tag ${release.tag_name} 失败: ${tagRes.status}`)
  }

  return true
}

async function main() {
  console.log(`\n📦 仓库: ${owner}/${repo}`)
  console.log(`📊 保留最新 ${keepCount} 个 release`)
  if (dryRun) console.log('🔍 预览模式 (不会实际删除)\n')

  const releases = await fetchAllReleases()
  console.log(`📋 共找到 ${releases.length} 个 release\n`)

  if (releases.length <= keepCount) {
    console.log('✅ release 数量不超过保留数，无需清理')
    return
  }

  // 按发布时间排序（最新在前）
  releases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at))

  const toKeep = releases.slice(0, keepCount)
  const toDelete = releases.slice(keepCount)

  console.log(`💾 保留的 release (${toKeep.length}):`)
  toKeep.forEach(r => {
    console.log(`   ✅ ${r.tag_name}  (${r.name})  —  ${r.published_at?.split('T')[0]}`)
  })

  console.log(`\n🗑️  要删除的 release (${toDelete.length}):`)
  toDelete.forEach(r => {
    console.log(`   ❌ ${r.tag_name}  (${r.name})  —  ${r.published_at?.split('T')[0]}`)
  })

  if (dryRun) {
    console.log('\n🔍 预览模式结束，未执行删除')
    return
  }

  console.log('\n🚀 开始删除...')
  let deleted = 0
  for (const release of toDelete) {
    process.stdout.write(`   删除 ${release.tag_name} ... `)
    const ok = await deleteRelease(release)
    if (ok) {
      console.log('✅')
      deleted++
    }
  }

  console.log(`\n🎉 完成！已删除 ${deleted}/${toDelete.length} 个 release`)
}

main().catch(err => {
  console.error('💥 出错了:', err.message)
  process.exit(1)
})
