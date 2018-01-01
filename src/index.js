const crypto = require('crypto')
const path = require('path')
const fse = require('fs-extra')
const globby = require('globby')

const fixedRootFiles = [
  'favicon.ico',
  'humans.txt',
  'robots.txt',
  'sitemap.xml',
  '.well-known'
]

const fixedNamesPatterns = ['!**/.well-known/**']

const ensureArray(item) => Array.isArray(item) ? item : [item]

const trimSlashes = str => {
  if (str.startsWith('/')) {
    str = str.substring(1)
  }
  if (str.endsWith('/')) {
    str = str.substring(0, str.length - 1)
  }
  return str
}

const toPath = str => {
  str = trimSlashes(str)
  return str.replace('/', path.sep)
}

const hashFile = contents => {
  const hash = crypto.createHash('sha256')
  hash.update(contents)
  return hash.digest('hex').substring(0, 8)
}

const generateNewName = (file, checksum) => {
  const dirname = path.dirname(file)
  const ext = path.extname(file)
  const basename = path.basename(file, ext)
  return path.join(dirname, `${basename}.${checksum}${ext}`)
}

const renameStatics = async (src, staticPatterns) => {
  const mapping = {}
  const files = await globby(staticPatterns, { cwd: src })
  const promises = files.map(async file => {
    const filename = path.resolve(src, file)
    const contents = await fse.readFile(filename)
    const checksum = hashFile(contents)
    const newFile = generateNewName(file, checksum)
    await fse.rename(filename, path.resolve(src, newFile))
    mapping[file] = newFile
  })
  await Promise.all(promises)
  return mapping
}

const shuffleDirs = async (staticSrc, staticTarget, targetPrefix) => {
  staticSrc = path.resolve(staticSrc)
  const tmpSrc = path.join(path.dirname(staticSrc), '__static')
  await fse.rename(staticSrc, tmpSrc)
  await fse.ensureDir(path.dirname(staticTarget))
  await fse.move(tmpSrc, staticTarget)
}

const getAllPatterns = (staticPatterns, rootFiles) => {
  staticPatterns = ensureArray(staticPatterns)
  return staticPatterns
    .concat(fixedNamesPatterns)
    .concat(rootFiles.map(file => `!${file}`))
}

const replaceRefs = async (
  dir,
  patterns,
  currentPrefix,
  targetPrefix,
  mappings
) => {
  targetPrefix = trimSlashes(targetPrefix)
  const files = await globby(patterns, { cwd: path.resolve(dir) })
  const regex = new RegExp(
    `(['"])\/${trimSlashes(currentPrefix)}/(.*?)(['"?])`,
    'g'
  )

  for (let file of files) {
    const filename = path.resolve(dir, file)
    const contents = await fse.readFile(filename, 'utf-8')
    const replaced = contents.replace(regex, (match, p1, uri, p3) => {
      const newUri = mappings[uri] || uri
      return `${p1}/${targetPrefix}/${newUri}${p3}`
    })
    await fse.writeFile(filename, replaced)
  }
}

const bumpRootFiles = async (currentDir, rootDir, rootFiles) => {
  const fullFiles = rootFiles.map(file => path.resolve(currentDir, file))
  const uniqueFiles = [...new Set(fullFiles)]
  const existingFiles = uniqueFiles.filter(file => fse.pathExistsSync(file))
  const promises = existingFiles.map(file => {
    const newFile = path.join(rootDir, path.basename(file))
    fse.move(file, newFile)
  })
  await Promise.all(promises)
}

const cachebust = async ({
  cwd,
  replacePatterns = '**/*.+(js|json|css|html)',
  staticSrc,
  staticDest,
  staticPatterns = ['**/*'],
  currentPrefix,
  targetPrefix,
  extraRootFiles = [],
  moveRootFiles = false
} = {}) => {
  if(!cwd) { throw new Error('cwd property is required') }
  if(!currentPrefix) { throw new Error('currentPrefix is required') }
  staticSrc = staticSrc || path.join(cwd, currentPrefix)
  staticDest = staticDest || cwd
  targetPrefix = targetPrefix || currentPrefix
  const staticTarget = path.join(staticDest, toPath(targetPrefix))

  await shuffleDirs(staticSrc, staticTarget, targetPrefix)
  extraRootFiles = ensureArray(extraRootFiles)
  const allRootFiles = fixedRootFiles.concat(extraRootFiles)
  const allPatterns = getAllPatterns(staticPatterns, allRootFiles)
  const mappings = await renameStatics(staticTarget, allPatterns)
  await replaceRefs(cwd, replacePatterns, currentPrefix, targetPrefix, mappings)
  if (moveRootFiles) {
    bumpRootFiles(staticTarget, staticDest, allRootFiles)
  }
}

module.exports = cachebust
module.exports.NEXT = {
  cwd: './next'
  currentPrefix: '/static',
}
module.exports.CRA = {
  cwd: './build'
  currentPrefix: '/public',
}