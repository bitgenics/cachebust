const path = require('path')
const fse = require('fs-extra')
const cachebust = require('../dist/index.js')

const test = async () => {
  const nextDir = path.resolve(__dirname, '../test/.next')
  await fse.remove(nextDir)
  await fse.ensureDir(path.dirname(nextDir))
  await fse.copy(path.resolve(__dirname, '../test/data/next'), nextDir)
  const nextStaticDir = path.join(nextDir, 'static')
  await cachebust({
    cwd: nextDir,
    staticDest: nextStaticDir,
    targetPrefix: '/_assets',
    extraRootFiles: ['serviceworker.js', '.well-known'],
    moveRootFiles: false
  })
  //await fse.remove(nextDir)
}
test()
