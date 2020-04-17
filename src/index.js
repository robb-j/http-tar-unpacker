//
// The app entrypoint
//

require('dotenv').config()

const { join } = require('path')
const fse = require('fs-extra')
const crypto = require('crypto')

const express = require('express')
const tar = require('tar')
const { validateEnv } = require('valid-env')

const pkg = require('../package.json')
const debug = require('debug')('unpacker')

//
// Unpack environment variables and set default values
//
const {
  WORK_DIR,
  SECRET_KEY,
  INDEX_MESSAGE = 'Hello, world!',
  MAX_UPLOAD = '64mb',
} = process.env

//
// A middleware to check for an Authorization:Bearer header
//
const authMiddleware = (req, res, next) => {
  const { authorization = '' } = req.headers

  if (authorization !== `Bearer ${SECRET_KEY}`) {
    debug(`auth failed`)
    return res.status(401).send('Not Authorized')
  }

  debug(`auth passed`)
  next()
}

//
// A function to log an optional error, shutdown a http server and exit the process
//
async function shutdown(server, error) {
  debug(`shutdown`)

  if (error) {
    console.error('error:', error)
  }

  server.close((error) => {
    if (error) {
      console.error('error:', error)
      process.exitCode = 1
    }
    process.exit()
  })
}

//
// Hash the contents of a buffer to make a filename
//
function hash(buffer) {
  const h = crypto.createHash('sha256')
  h.update(buffer, 'base64')
  return h.digest('hex')
}

//
// App entrypoint
//
;(async () => {
  debug(`starting`)

  validateEnv(['WORK_DIR', 'SECRET_KEY'])

  try {
    debug(`ensuring workdir=${WORK_DIR}`)
    fse.ensureDirSync(WORK_DIR)

    const app = express()
    let isProcessing = false

    app.use(
      express.raw({
        limit: MAX_UPLOAD,
        type: 'application/gzip',
      })
    )

    //
    // Respond to a get, so we know things are working
    //
    app.get('/', (req, res) => {
      debug(`get: /`)
      res.send({
        pkg: {
          name: pkg.name,
          version: pkg.version,
        },
        message: INDEX_MESSAGE || 'Hello, world!',
      })
    })

    app.post('/', authMiddleware, async (req, res, next) => {
      debug(`post: /`)

      try {
        //
        // Lock the processing
        //
        debug(`isProcessing=${isProcessing}`)
        if (isProcessing) throw new Error('Already in progress')
        isProcessing = true

        //
        // Grab the archive buffer & generate paths and filenames
        //
        const rawArchive = req.body
        const hashName = hash(rawArchive)
        const targetPath = join(WORK_DIR, hashName)
        const archivePath = join(WORK_DIR, hashName, 'archive.tar.gz')
        const symlinkPath = join(WORK_DIR, 'current')

        debug(`hashName=${hashName}`)

        //
        // Create the directory, put the archive in it and untar it
        // if it doesn't already exists
        //
        const extractExists = await fse.pathExists(targetPath)
        if (!extractExists) {
          // Create the directory
          debug(`extract targetPath=${targetPath}`)
          await fse.ensureDir(targetPath)

          // Put the archive in it
          debug(`create archivePath=${archivePath}`)
          await fse.writeFile(archivePath, rawArchive)

          // Extract the archive
          await tar.x({
            file: archivePath,
            cwd: targetPath,
          })

          // Remove the archive file
          debug(`unlink archivePath=${archivePath}`)
          await fse.unlink(archivePath)
        } else {
          debug(`extract skipped`)
        }

        //
        // Update the symlink, synchronously to reduce errors
        //
        if (fse.existsSync(symlinkPath)) {
          debug(`remove symlinkPath=${symlinkPath}`)
          fse.unlinkSync(symlinkPath)
        }

        debug(`symlink symlinkPath=${symlinkPath}`)
        fse.symlinkSync(hashName, symlinkPath)

        //
        // Remove any non-active folders
        //
        const contents = await fse.readdir(WORK_DIR)
        const toKeep = ['current', hashName]
        const toRemove = contents.filter((item) => !toKeep.includes(item))
        debug(`contents=[${contents.join(',')}]`)
        debug(`toRemove=[${toRemove.join(',')}]`)

        await Promise.all(
          toRemove.map((path) =>
            fse.rmdir(join(WORK_DIR, path), { recursive: true })
          )
        )

        debug('done message=ok')
        res.send({ message: 'ok' })
      } catch (error) {
        //
        // Send back any errors and log them too
        //
        console.error('error:', error.message)
        res.status(400).send({ message: error.message })
      } finally {
        //
        // Always reset the lock
        //
        isProcessing = false
        debug(`isProcessing=${isProcessing}`)
      }
    })

    //
    // Start the server
    //
    await new Promise((resolve) => {
      const server = app.listen(3000, resolve)

      process.on('SIGINT', () => shutdown(server))
      process.on('SIGTERM', () => shutdown(server))
      process.on('uncaughtException', (err) => shutdown(server, err))
      process.on('unhandledRejection', (err) => shutdown(server, err))
    })
    console.log('Listening on :3000')
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
})()
