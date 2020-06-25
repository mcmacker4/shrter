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

    // Database connection
    const mongoHost = process.env.MONGODB_HOST || 'localhost/shrter'
    const db = await monk(mongoHost)
    const urls = db.get('urls')

    urls.createIndex('id')

    const log = debug('shrter')
    const loghttp = debug('shrter:http')

    const app = new Koa()

    app.use(bodyparser({ enableTypes: ['json'] }))
    app.use(logger({ transporter: (str) => loghttp(str) }))
    app.use(serve('public'))

    const router = new Router()

    router.get('/:id', async ctx => {
        const { id } = ctx.params

        try {
            const url = await urls.findOne({ id })
            ctx.status = 301
            ctx.redirect(url.url)
        } catch (error) {
            log(error.message)
        }
    })

    const schema = object().shape({
        id: string().default(() => nanoid(6)).trim().min(1),
        url: string().url()
    })
    router.post('/url', async ctx => {
        try {
            const body = await schema.validate(ctx.request.body, { stripUnknown: true })
            await urls.insert(body)
        } catch (error) {
            ctx.status = error.status || 500
            ctx.body = { error: error.message, stack: error.stack }
        }
    })

    app.use(router.allowedMethods())
    app.use(router.middleware())

    const port = process.env.PORT || 8080
    app.listen(port, () => log("Listening..."))

}
