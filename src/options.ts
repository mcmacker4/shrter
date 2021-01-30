import path from 'path'

interface Options {
    captcha: {
        sitekey: string
        secret: string
    }
    discord: {
        url: string
    }
}

const optionsPath = path.resolve(__dirname, '../options.json')

export const options = require(optionsPath) as Options
