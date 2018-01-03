const path = require('path')
const fse = require('fs-extra')
const cachebust = require('../dist/index.js')

const test = async () => {
  const rootDir = path.resolve(__dirname, '../run_test/next_linc')
  await fse.remove(rootDir)
  await fse.ensureDir(path.dirname(rootDir))
  await fse.copy(path.resolve(__dirname, '../test/data/next'), rootDir)
  const nextStaticDir = path.join(rootDir, 'static')
  const report = await cachebust({
    cwd: rootDir,
    distDir: './.next',
    currentPrefix: 'static',
    targetPrefix: '_assets',
    staticSrc: './static',
    staticDest: './.next/static',
    extraRootFiles: 'serviceworker.js',
    moveRootFiles: true,
    overwrite: false
  })
  console.log(report)
  //await fse.remove(rootDir)
}
test()
