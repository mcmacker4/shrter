import querystring from 'querystring'
import got from 'got'
import {Context, Next} from 'koa'
import debug from 'debug'
import {readFile} from "fs/promises";

interface CaptchaResponseFail {
    success: false
    "error-codes": string[]
}

interface CaptchaResponseSuccess {
    success: boolean,
    challenge_ts: string,
    hostname: string,
    score: number
    action: string
}

type CaptchaResponse = CaptchaResponseSuccess | CaptchaResponseFail

const logcaptcha = debug('shrter:captcha')

async function resolveCaptchaSecret(): Promise<string | undefined> {
    if (process.env['CAPTCHA_SECRET_FILE'])
        return (await readFile(process.env['CAPTCHA_SECRET_FILE'])).toString()
    else if (process.env['CAPTCHA_SECRET'])
        return process.env['CAPTCHA_SECRET']
}


export function captchaFilter() {
    return async (ctx: Context, next: Next) => {
        const captchaToken = ctx.headers['x-captcha']
        const captchaResponse = await got.post(
            'https://www.google.com/recaptcha/api/siteverify',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
                },
                body: querystring.stringify({
                    secret: await resolveCaptchaSecret(),
                    response: captchaToken,
                    remoteip: ctx.request.ip
                })
            }
        ).json<CaptchaResponse>()

        if (captchaResponse.success && captchaResponse.score >= 0.9) {
            await next()
        } else {
            logcaptcha("Captcha failed: %o", captchaResponse)
            ctx.throw(400, "Captcha Failed.")
        }
    }
}
