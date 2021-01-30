import got from 'got'
import { options } from './options'
import {URLEntry} from '.'

const hookUrl = options.discord.url

export async function discordAlert(url: URLEntry) {
    
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
