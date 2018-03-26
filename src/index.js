const crypto = require('crypto')
const path = require('path')
const fse = require('fs-extra')
const globby = require('globby')

const fixedRootFiles = [
  'favicon.ico',
  'humans.txt',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'sw.js',
  'service-worker.js',
  '.well-known'
]

const fixedNamesPatterns = ['!**/.well-known/**']

const ensureArray = item => (Array.isArray(item) ? item : [item])

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
  let ext = path.extname(file)
  if(ext === '.map') {
    ext = path.extname(path.basename(file, ext)) + '.map'
  }
  const basename = path.basename(file, ext)
  return path.join(dirname, `${basename}.${checksum}${ext}`)
}

const findFiles = async (src) => {
  const files = await globby(['**/*'], { cwd: src })
  const mapping = {}
  files.forEach((file) => {
    mapping[file] = file
  })
  return mapping
}

const hashFiles = async (src, mapping, staticPatterns) => {
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

const shuffleDirs = async (staticSrc, staticTarget, overwrite) => {
  staticSrc = path.resolve(staticSrc)
  if (overwrite) {
    const tmpSrc = path.join(path.dirname(staticSrc), '__static')
    await fse.rename(staticSrc, tmpSrc)
    await fse.ensureDir(path.dirname(staticTarget))
    await fse.move(tmpSrc, staticTarget)
  } else {
    await fse.copy(staticSrc, staticTarget)
  }
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
  const files = await globby(patterns, { cwd: path.resolve(dir) })
  const regex = new RegExp(
    `([('"])\s?(https?:\/\/[\\w\\.-]*?)?\/?${trimSlashes(
      currentPrefix
    )}\/(.*?)([)'"?])`,
    'g'
  )
  const report = {}

  for (let file of files) {
    const filename = path.resolve(dir, file)
    const contents = await fse.readFile(filename, 'utf-8')
    const replaced = contents.replace(
      regex,
      (match, p1, domain, fragment, p4) => {
        if(mappings[fragment]) {
          fragment = mappings[fragment] || fragment
          const newUrl = `${p1}${domain || ''}${targetPrefix}/${fragment}${p4}`
          const list = report[file] || []
          list.push({ from: match, to: newUrl })
          report[file] = list
          return newUrl  
        } else {
          return match
        }
      }
    )
    await fse.writeFile(filename, replaced)
  }
  return report
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
  buildDir,
  currentPrefix,
  cwd = '.',
  distDir,
  extraRootFiles = [],
  moveRootFiles = false,
  hash = true,
  overwrite,
  replacePatterns = '**/*.+(js|json|css|html)',
  staticSrc,
  staticDest,
  staticPatterns = ['**/*'],
  targetPrefix
} = {}) => {
  distDir = distDir || buildDir
  if (!distDir) {
    throw new Error('distDir property is required')
  }
  distDir = path.resolve(cwd, distDir)
  if (!currentPrefix) {
    throw new Error('currentPrefix is required')
  }
  staticSrc = staticSrc
    ? path.resolve(cwd, staticSrc)
    : path.resolve(distDir, toPath(currentPrefix))
  staticDest = staticDest ? path.resolve(cwd, staticDest) : distDir
  targetPrefix = targetPrefix || currentPrefix
  const staticTarget = path.join(staticDest, toPath(targetPrefix))
  extraRootFiles = ensureArray(extraRootFiles)
  const allRootFiles = fixedRootFiles.concat(extraRootFiles)
  const allPatterns = getAllPatterns(staticPatterns, allRootFiles)

  try {
    const sameDir = staticSrc === staticTarget
    const srcInDist = staticSrc.startsWith(distDir)
    if(sameDir && !srcInDist && !overwrite) {
      throw new Error(`The src and destination for the files are the same and outside the build directory.
To prevent you from accidently renaming your source folder we require the explicit 'overwrite' options to be set`)
    }
    if (!sameDir) {
      const move = overwrite || srcInDist
      await shuffleDirs(staticSrc, staticTarget, move)
    }
    const mappings = await findFiles(staticTarget)
    if(hash) {
      await hashFiles(staticTarget, mappings, allPatterns)
    }

    const replaceOptions = [
      replacePatterns,
      currentPrefix,
      targetPrefix,
      mappings
    ]
    let report = await replaceRefs(distDir, ...replaceOptions)
    const targetInDist = staticTarget.startsWith(distDir)
    if (!targetInDist) {
      const report2 = await replaceRefs(staticTarget, ...replaceOptions)
      report = Object.assign({}, report, report2)
    }
    return report
    if (moveRootFiles) {
      bumpRootFiles(staticTarget, staticDest, allRootFiles)
    }
  } catch (e) {
    console.log(e)
  }
}

module.exports = cachebust
module.exports.NEXT_SAFE = (extra = {}) => {
  const defaults = {
    distDir: './.next',
    staticSrc: './static',
    currentPrefix: '/static',
    overwrite: false
  }
  return Object.assign({}, defaults, extra)
}

module.exports.NEXT_OVERWRITE = (extra = {}) => {
  const defaults = {
    distDir: './.next',
    staticSrc: './static',
    staticDest: '.',
    currentPrefix: '/static',
    overwrite: true
  }
  return Object.assign({}, defaults, extra)
}

module.exports.CRA = (extra = {}) => {
  const defaults = {
    distDir: './build',
    currentPrefix: '/public'
  }
  return Object.assign({}, defaults, extra)
}
