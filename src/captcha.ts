import { options } from './options'
import querystring from 'querystring'
import got from 'got'
import {Context, Next} from 'koa'
import debug from 'debug'

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
                    secret: options.captcha.secret,
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
