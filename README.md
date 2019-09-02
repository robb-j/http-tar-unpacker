# http-tar-unpacker

Coming soon...

## What is this?

The idea behind this project is to create a docker image that bridges the gap
between docker-based DevOps and using a static site generator.

**shopping list**

- I want to push to a master branch and it automatically build and deploy generated assets
- I don't want to faff around with unix users and permissions
- I want the process to be entirely in docker-compose files for transparency

## What problem does this solve

My current solution is to use `rsync` to manually sync files from a generator
to the web.

```bash
eleventy && rsync -azv --delete dist/* root@example.com:/srv/static/my-site
```

**Problems with this:**

- There is no relation between git commits and publishes
- Its a manual process that has to be run
- You have to have use a unix user on a system

---

> This project was set up by [puggle](https://npm.im/puggle)
