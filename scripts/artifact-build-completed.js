const fs = require('fs')
const path = require('path')

exports.default = function (buildResult) {
  try {
    console.log('[artifact build completed] rename artifact file...')
    if (!buildResult.file.includes(' ')) {
      return
    }

    const oldFilePath = buildResult.file
    const newfilePath = oldFilePath.replace(/ /g, '-')

    if (path.dirname(oldFilePath) !== path.dirname(newfilePath)) {
      throw new Error(`Refusing to move artifact outside its build directory: ${newfilePath}`)
    }

    fs.rmSync(newfilePath, { force: true })
    fs.renameSync(oldFilePath, newfilePath)
    buildResult.file = newfilePath
    console.log(`[artifact build completed] rename file ${oldFilePath} to ${newfilePath} `)
  } catch (error) {
    console.error('Error renaming file:', error)
    throw error
  }
}
