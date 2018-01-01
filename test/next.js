const path = require('path')
const fse = require('fs-extra')
const cachebust = require('../dist/index.js')

const test = async () => {
  const rootDir = path.resolve(__dirname, '../test/next')
  await fse.remove(rootDir)
  await fse.ensureDir(path.dirname(rootDir))
  await fse.copy(path.resolve(__dirname, '../test/data/next'), rootDir)
  const nextStaticDir = path.join(rootDir, 'static')
  await cachebust({
    distDir: path.join(rootDir, '.next'),
    currentPrefix: 'static',
    staticSrc: nextStaticDir,
    extraRootFiles: 'serviceworker.js',
  })
  //await fse.remove(rootDir)
}
test()
