# http-tar-unpacker

A tiny express server that accepts tar files, unpacks them and symlink the latest.
Designed for doing a jamstack yourself.

<!-- toc-head -->

## Table of contents

- [What is this?](#what-is-this)
- [How it works](#how-it-works)
- [Usage](#usage)
- [Development](#development)
  - [Setup](#setup)
  - [Regular use](#regular-use)
  - [Irregular use](#irregular-use)
  - [Code formatting](#code-formatting)
- [Releasing](#releasing)
  - [Building the image](#building-the-image)
- [Future work](#future-work)

<!-- toc-tail -->

## What is this?

The idea behind this project is to create a docker image that bridges the gap
between DevOps and static site generators.
For example:

- You want to push to a master branch an it automatically builds and deploys generated assets
- You don't want to faff around with unix users, permissions and ssh keys
- You want the deployment to be defined in code

## How it works

Unpacker runs an express server which has a pre-shared key and a volume to work in.
You post it an archive, authenticated with the pre-shared key.
The server unpacks the archive in its volume, making a new folder by hashing the archive itself.
It then updates a `current` symlink to point to the new folder.

You have another container (link nginx) that mounts the same volume in
and is setup to serve the content that is in `current` symlink.

Once deployed, unpacker also cleans up its volume to remove any non-latest archives.
It will only remove folders that are named with 64 hexadecimal characters (a-f & 0-9).

> The symlink is to reduce the downtime when a build is happening
> and means that it falls back to the previous "current" if something fails along the way.

<details>
<summary>More details</summary>

Say the server has the following working volume:

```
workdir
├── current -> abcdefgh
└── abcdefgh
    └── ...
```

You post up a new archive which has the hash `zxywvuts`.
It uploads the archive into its own folder, so it becomes:

> To generate the hash it base64-encodes the raw archive binary
> creates a sha256 hash from it and encodes the result as hex.

```diff
 workdir
 ├── current -> abcdefgh
 ├── abcdefgh
 │   └── ...
+└── zxywvuts
+    └── archive.tar.gz/
```

Then it expands the archive into that folder,
remove the archive
and updates the `current` symlink:

```diff
 workdir
-├── current -> abcdefgh
+├── current -> zxywvuts
 └── abcdefgh
 │   └── ...
 └── zxywvuts
-    └── archive.tar.gz/
     └── ...
```

Once it's all done it removes the old folder

```diff
 workdir
 ├── current -> zxywvuts
-├── abcdefgh
-│   └── ...
 └── zxywvuts
     └── ...
```

</details>

## Usage

You run unpacker using the docker image, providing it with the pre-shared key and volume to work in.

**environment variables**

- `SECRET_KEY` - set this to a secret value that only your deployment script knows,
  this is used to authenticate requests.
- `KEEP_ARCHIVES` - (optional) set to `true` to keep the uploaded archive as `archive.tar.gz` in each folder,
  will be overidden if the tar itself already has a file with the same name.
  It means you can easily re-download the version pre-archived.

**volumes**

- `/app/workdir` - share this volume between your http container (e.g. nginx)
  - **important** You must mount the containing folder,
    the symlink wont work if you just mount that.

So if it is deployed at `DEPLOY_URL` with a preshared key `DEPLOY_KEY`, you can setup a CI/CD to:

```bash
# Install your production & dev dependencies
npm ci

# Run your build command (something that generates your site)
npm run build

# Tar the generated assets and post up to you
tar -zc -C your_dist_folder . \
  | curl --silent \
    --header "Content-Type: application/gzip" \
    --header "Authorization: Bearer $DEPLOY_KEY" \
    --data-raw @- \
    $DEPLOY_URL
```

For a more detailed setup, see [example/deployment](/example/deployment)

## Development

### Setup

To develop on this repo you will need to have [Docker](https://www.docker.com/) and
[node.js](https://nodejs.org) installed on your dev machine and have an understanding of them.
This guide assumes you have the repo checked out and are on macOS, but equivalent commands are available.

You'll only need to follow this setup once for your dev machine.

```bash
# Install node.js dependencies
npm install

# Setup your environment
# -> Set SECRET_KEY to something to test with
cp .env.example .env
```

### Regular use

These are the commands you'll regularly run to develop the API, in no particular order.

```bash
# Run the api in development mode
# -> Uses nodemon to restart on code changes
# -> Runs on port 3000
# -> Creates a 'workdir' folder to put archives into
npm run dev

# Load .env into the local shell (useful for below)
source .env

# Test the post endpoint  with the test archive
# -> using httpie.org
cat example/archive.tar.gz | http :3000 \
  Content-Type:application/gzip \
  Authorization:Bearer\ $SECRET_KEY
```

### Irregular use

These are commands you might need to run but probably won't, also in no particular order.

```bash
# tar the example app
./bin/make-tar

# Build the image based on the package.json version
# -> this runs in the package.json's "postversion"
./bin/version

# run the example stack
cd example/deployment
docker-compose up -d

# stop the example stack & clear volumes
docker-compose down -v
```

### Code formatting

This repo uses [Prettier](https://prettier.io/) to automatically format code to a consistent standard.
It works using the [husky](https://www.npmjs.com/package/husky)
and [lint-staged](https://www.npmjs.com/package/lint-staged) packages to
automatically format code whenever it is commited.
This means that code that is pushed to the repo is always formatted to a consistent standard.

You can manually run the formatter with `npm run prettier` if you want.

Prettier is slightly configured in [package.json#prettier](/package.json)
and can ignore files using [.prettierignore](/.prettierignore).

## Releasing

### Building the image

There is an npm `postversion` script setup to build the docker image
locally and push it up to dockerhub.

This means docker images should be [semantically versioned](https://semver.org/) and tagged in git.
The `:latest` tag is not used.

```bash
# Deploy a new version of the CLI
npm version # major | minor | patch | x.y.z
git push --tags
```

## Future work

- Setup [commit-ops](https://blog.r0b.io/post/automating-developer-operations-for-nodejs/) when 1.0.0 is reached
- Add unit tests
- Add a GitHub actions example
- Add a regex to only delete hex folders in the volume and/or add a prefix
- Add option to keep the archive around

---

> This project was set up by [puggle](https://npm.im/puggle)
