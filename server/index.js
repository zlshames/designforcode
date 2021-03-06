import dotenv from 'dotenv'
import path from 'path'

import bodyParser from 'koa-bodyparser'
import koa from 'koa'
import koaRouter from 'koa-router'
import serve from 'koa-static'
import sendFile from 'koa-sendfile'

dotenv.config()

// Instantiate koa and koa-router
const app = koa()
const router = koaRouter()

// Serve static files
app.use(serve(`${__dirname}/../public/`))

// Enable bodyparser and router
app.use(bodyParser())
app.use(router.routes())
app.use(router.allowedMethods())

// Serve routes
require('./routes/UserRoutes')(router)
require('./routes/AuthRoutes')(router)
require('./routes/CommentRoutes')(router)
require('./routes/PostRoutes')(router)

// Serve front-end route
router.get('*', function * (next) {
  yield sendFile(this, path.join(__dirname, '../public/index.html'))
  yield next
})

const host = process.env.SERVER_HOST
const port = process.env.SERVER_PORT

app.listen(port, host, () => {
  console.log(`Available on http://${ host }:${ port }`)
})
