import Koa from 'koa'
import bodyparser from 'koa-bodyparser'
import Router from 'koa-router'
import serve from 'koa-static'
import ratelimit from 'koa-ratelimit'
import cors from '@koa/cors'
import debug from 'debug'
import { MongoClient } from 'mongodb'
import { object, string, ValidationError } from 'yup'
import { nanoid } from 'nanoid'
import { discordAlert } from './discord'
import {captchaFilter} from './captcha'


export interface URLEntry {
    id: string
    url: string
}


async function main() {

    const log = debug('shrter:app')
    const loghttp = debug('shrter:http')

    // Database connection
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/shrter'
    const mongoClient = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })

    await mongoClient.connect()
    const urls = mongoClient.db().collection<URLEntry>('urls')
    
    urls.createIndex('id', { unique: true })

    const app = new Koa()
    app.proxy = true

    app.use(async (ctx, next) => {
        const start = Date.now()
        try {
            await next()
        } catch (e) {
            loghttp(`${ctx.ip} - ${ctx.method} ${ctx.path} - ${e.status || 500} ${Date.now() - start}ms`)
            throw e
        }
        loghttp(`${ctx.ip} - ${ctx.method} ${ctx.path} - ${ctx.status} ${Date.now() - start}ms`)
    })

    app.use(cors())

    app.use(bodyparser({ enableTypes: ['json'] }))
    app.use(serve('public'))

    const router = new Router()

    router.get('/:id', async ctx => {
        const { id } = ctx.params
        try {
            const result = await urls.findOne({ id })
            if (result) {
                ctx.status = 301
                ctx.redirect(result.url)
            } else {
                ctx.status = 404
            }
        } catch (error) {
            log(error.message)
            ctx.status = 500
        }
    })

    const ratelimitDb = new Map()
    router.use('/url', ratelimit({
        driver: 'memory',
        db: ratelimitDb,
        max: 30, // 1 every 2 minutes
        disableHeader: true
    }))

    // Captcha Filter
    router.use('/url', captchaFilter())

    const schema = object<URLEntry>().shape({
        id: string().default(() => nanoid(6)).trim().max(16).matches(/^[\w\-]+$/i),
        url: string().url().required()
    })
    router.post('/url', async ctx => {
        try {
            const body = await schema.validate(ctx.request.body, { stripUnknown: true })
            if (await urls.findOne({ id: body.id })) {
                ctx.throw(400, "Slug is already in use.")
            }
            const result = await urls.insertOne(body)
            ctx.body = { id: result.ops[0].id }

            discordAlert(body)

        } catch (e) {
            if (e instanceof ValidationError)
                ctx.throw(400, e.message)
            else
                ctx.throw(e)
        }
    })

    app.use(router.allowedMethods())
    app.use(router.middleware())

    const port = process.env.PORT || 8080
    app.listen(port, () => log("Listening on port %d", port))

}

main().catch(error => console.error(error))
