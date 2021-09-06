import got from 'got'
import {URLEntry} from '.'


const hookUrl = process.env['DISCORD_HOOK']

export async function discordAlert(url: URLEntry) {

    if (!hookUrl)
        return

    await got.post(hookUrl, {
        json: {
            embeds: [
                {
                    title: 'New Shortened URL',
                    color: 0x4281f5,
                    fields: [
                        {
                            name: 'Short URL',
                            value: `https://s.hgg.es/${url.id}`
                        },
                        {
                            name: 'Long URL',
                            value: url.url
                        }
                    ]
                }
            ]
        }
    })

}
