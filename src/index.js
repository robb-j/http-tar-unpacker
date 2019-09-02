//
// The app entrypoint
//

require('dotenv').config()

const { join } = require('path')
const fse = require('fs-extra')

const express = require('express')
const fileupload = require('express-fileupload')
const tar = require('tar')
const { validateEnv } = require('valid-env')

const UPLOAD_FILENAME = 'archive'
const TEMP_DIR = join(__dirname, '../tmp')
const TEMP_CONTENTS = join(TEMP_DIR, 'contents')

//
// Unpack environment variables and set default values
//
const {
  DESTINATION_DIR,
  SECRET_KEY,
  INDEX_MESSAGE = 'Hello, world!'
} = process.env

//
// A middleware to check for an Authorization:Bearer header
//
const authMiddleware = (req, res, next) => {
  const { authorization = '' } = req.headers

  const match = /^Bearer (\S+)$/.exec(authorization)

  if (!match || match[1] !== SECRET_KEY) {
    return res.status(401).send('Not Authorized')
  }

  next()
}

;(async () => {
  validateEnv(['DESTINATION_DIR', 'SECRET_KEY'])

  try {
    fse.ensureDirSync(TEMP_DIR)
    fse.ensureDirSync(DESTINATION_DIR)

    const app = express()
    let isProcessing = false

    app.use(fileupload())

    //
    // Respond to a get, so we know things are working
    //
    app.get('/', (req, res) => {
      res.send(INDEX_MESSAGE || 'Hello, world!')
    })

    //
    // Respond to a post request to handle file uploads
    //
    app.post('/', authMiddleware, async (req, res) => {
      try {
        //
        // Lock the processing
        //
        if (isProcessing) throw new Error('Already in progress')
        isProcessing = true

        //
        // Clean the temporary directory
        //
        fse.emptyDir(TEMP_CONTENTS)

        //
        // Check they uploaded a file
        //
        const file = req.files && req.files[UPLOAD_FILENAME]
        if (!file) throw new Error(`'${UPLOAD_FILENAME}' file is missing`)

        //
        // Put the archive into temporary directory
        //
        const archivePath = join(TEMP_DIR, 'archive.tar.gz')
        await new Promise((resolve, reject) => {
          file.mv(archivePath, err => (err ? reject(err) : resolve()))
        })

        //
        // Clean the destination folder
        //
        await fse.emptyDir(DESTINATION_DIR)

        //
        // Untar the file into the destination folder
        //
        await tar.x({
          file: archivePath,
          cwd: DESTINATION_DIR
        })

        res.send('ok')
      } catch (error) {
        //
        // Send back any errors
        //
        res.status(400).send(error.message)
      } finally {
        //
        // Always reset the lock
        //
        isProcessing = false
      }
    })

    //
    // Start the server
    //
    await new Promise(resolve => app.listen(3000, resolve))
    console.log('Listening on :3000')
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
})()
