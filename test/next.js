const path = require('path')
const fse = require('fs-extra')
const cachebust = require('../dist/index.js')

const test = async () => {
  const rootDir = path.resolve(__dirname, '../run_test/next')
  await fse.remove(rootDir)
  await fse.ensureDir(path.dirname(rootDir))
  await fse.copy(path.resolve(__dirname, '../test/data/next'), rootDir)
  const nextStaticDir = path.join(rootDir, 'static')
  const options = cachebust.NEXT_OVERWRITE({cwd: rootDir, extraRootFiles: 'serviceworker.js'})
  const report = await cachebust(options)
  console.log(report)
  //await fse.remove(rootDir)
}
test()
