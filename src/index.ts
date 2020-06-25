import Koa from 'koa'
import bodyparser from 'koa-bodyparser'
import Router, { url } from 'koa-router'
import logger from 'koa-logger'
import serve from 'koa-static'
import debug from 'debug'
import monk from 'monk'
import { object, string } from 'yup'
import { nanoid } from 'nanoid'

main().catch(error => console.error(error))

async function main() {

    const log = debug('shrter')
    const loghttp = log.extend('http')

    // Database connection
    const mongoHost = process.env.MONGODB_URI || 'localhost/shrter'
    log('MongoDB Host: %s', mongoHost)
    const db = monk(mongoHost)
    const urls = db.get('urls')
    urls.createIndex('id')

    const app = new Koa()

    app.use(bodyparser({ enableTypes: ['json'] }))
    app.use(logger({ transporter: (str) => loghttp(str) }))
    app.use(serve('public'))

    const router = new Router()

    router.get('/:id', async ctx => {
        const { id } = ctx.params
        try {
            const result = await urls.findOne({ id })
            log("Mongo Result: %O", result)
            if (result) {
                // ctx.status = 301
                log("Redirection URL: %s", result.url)
                ctx.redirect(result.url)
            } else {
                ctx.status = 404
            }
        } catch (error) {
            log(error.message)
            ctx.status = 500
        }
    })

    const schema = object().shape({
        id: string().default(() => nanoid(6)).trim().min(1),
        url: string().url().required()
    })
    router.post('/url', async ctx => {
        try {
            log("Incoming body: %O", ctx.request.body)
            const body = await schema.validate(ctx.request.body, { stripUnknown: true })
            log("Validated body: %O", body)
            const result = await urls.insert(body)
            log("Mongo Result: %O", result)
            ctx.body = { id: result.id }
        } catch (error) {
            ctx.status = error.status || 500
            ctx.body = { error: error.message, stack: process.env.NODE_ENV === 'production' ? "" : error.stack }
        }
    })

    app.use(router.allowedMethods())
    app.use(router.middleware())

    const port = process.env.PORT || 8080
    app.listen(port, () => log("Listening on port %d", port))

}
