import Koa from 'koa'
import bodyparser from 'koa-bodyparser'
import Router from 'koa-router'
import serve from 'koa-static'
import ratelimit from 'koa-ratelimit'
import cors from '@koa/cors'
import debug from 'debug'
import {readFile} from 'fs/promises'
import {createPool} from 'mysql2/promise'
import {object, string, ValidationError, SchemaOf} from 'yup'
import {nanoid} from 'nanoid'
import {discordAlert} from './discord'
import {captchaFilter} from './captcha'
import {UrlRepository} from "./repository";


export interface URLEntry {
    id: string
    url: string
}

async function resolveDatabasePassword(): Promise<string | undefined> {
    if (process.env['DB_PASSWORD_FILE'])
        return (await readFile(process.env['DB_PASSWORD_FILE'])).toString()
    else if (process.env['DB_PASSWORD'])
        return process.env['DB_PASSWORD']
}

async function main() {

    const log = debug('shrter:app')
    const loghttp = debug('shrter:http')

    // Database connection
    const sqlPool = createPool({
        host: process.env['HOST'] || 'localhost',
        database: process.env['DB_DATABASE'],
        user: process.env['DB_USER'],
        password: await resolveDatabasePassword()
    })

    const urls = new UrlRepository(sqlPool)

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
            const result = await urls.findById(id)
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

    const schema: SchemaOf<URLEntry> = object().shape({
        id: string().default(() => nanoid(6)).trim().max(16).matches(/^[\w\-]+$/i),
        url: string().url().required()
    })
    router.post('/url', async ctx => {
        try {
            const body: URLEntry = await schema.validate(ctx.request.body, { stripUnknown: true })
            if (await urls.findById(body.id)) {
                ctx.throw(400, "Slug is already in use.")
            }
            await urls.save(body)
            ctx.body = { id: body.id }

            discordAlert(body).catch()

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
