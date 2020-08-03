import fs from 'fs'
import axios from 'axios'
import gm from 'gm'
import { FONT_DIR } from './config'
import { JSONPath } from 'jsonpath-plus'
import cheerio from 'cheerio'
import { log } from 'wechaty'
const im = gm.subClass({ imageMagick: true })

/**
 * 枚举支持的主题
 */
export enum Theme {
  JSON,
  HTML,
  RE
}

/**
 * 根据jsonpath路径爬取json内容
 * @param url api接口的网址
 * @param params jsonpath路径的列表
 */
export async function getJsonData (
  url: string,
  params: string[]
): Promise<string[]> {
  const result: string[] = []
  try {
    const response: any = await axios.get(url)
    if (response.status === 200) {
      const data = response.data
      params.forEach((key) => {
        const ret = JSONPath({ json: data, path: key })
        if (ret.length) {
          result.push(ret.join('\n')) // 返回列表则换行
        }
      })
    }
  } catch (error) {
    log.error(error)
  }
  return result
}

/**
 * 根据url和css选择器爬取html内容
 * @param url api接口的网址
 * @param params css选择器的列表
 */
export async function getHTMLData (
  url: string,
  params: string[]
): Promise<string[]> {
  const result: string[] = []
  try {
    const response: any = await axios.get(url)
    if (response.status === 200) {
      const $ = cheerio.load(response.data)
      params.forEach((key) => {
        const ret = $(key).map(function (_i, el) {
          // this === el
          return $(el).text()
        }).get().join('\n')
        if (ret.length) {
          result.push(ret)
        }
      })
    }
  } catch (error) {
    log.error(error)
  }

  return result
}

/**
 * 根据正则表达式选取html内容
 * @param url api接口的网址
 * @param params 正则表达式的列表
 */
export async function getREData (
  url: string,
  params: string[]
): Promise<string[]> {
  const result: string[] = []
  try {
    const response: any = await axios.get(url)
    if (response.status === 200) {
      const data = response.data
      params.forEach((key) => {
        const pattern = new RegExp(key, 'g')
        const results = [...data.matchAll(pattern)]
        if (results.length) {
          results.forEach((ret) => {
            result.push(ret.length > 1 ? ret.slice(1) : ret[0]) // 有group则提取group
          })
        }
      })
    }
  } catch (error) {
    log.error(error)
  }
  return result
}

/**
 *
 * @param type 选择器的类型，一共有三种：jsonpath选择器，css选择器以及正则表达式
 * @param url 内容来源的网址
 * @param selectors 选择器字符串的列表
 */
export async function getWords (type: number, url: string, selectors: string[]): Promise<string[]> {
  let words: string[] = []
  switch (type) {
    case 0:
      words = await getJsonData(url, selectors)
      break
    case 1:
      words = await getHTMLData(url, selectors)
      break
    case 2:
      words = await getREData(url, selectors)
      break
  }
  if (!words.length) {
    log.error('Please make sure your config is correct')
  }
  return words
}

/**
 * 下载文件到本地
 * @param url 文件的链接地址
 * @param localPath 本地保存地址
 */

export async function downloadFile (url: string, localPath: string) {
  if (!fs.existsSync(localPath)) {
    // 文件存在
    try {
      const response = await axios({
        method: 'GET',
        responseType: 'stream',
        url,
      })
      const writer = fs.createWriteStream(localPath)
      response.data.pipe(writer)
      return new Promise((resolve: any, reject: any) => {
        writer.on('finish', resolve('success'))
        writer.on('error', (err) => {
          reject(err)
        })
      }).catch(log.error)
    } catch (error) {
      log.error(error)
    }
  }
}

/**
 * 生成一对互补随机颜色
 */
function generateColors (): [string, string] {
  const colors: [string, string] = ['', '']
  const colorMap: string[] = [
    '#7d2828',
    '#683671',
    '#584480',
    '#464678',
    '#384c70',
    '#23556f',
    '#2d6a6c',
    '#166856',
    '#20452a',
    '#645f46',
    '#7d644a',
    '#865846',
    '#76443c',
    '#6c3636',
    '#491616',
    '#123908',
    '#192053',
    '#3e318c',
    '#20554f',
    '#8a5837',
    '#516451',
  ]
  colors[0] = colorMap[Math.floor(Math.random() * colorMap.length)]
  colors[1]
    = '#'
    + (
      '000000'
      + (0xffffff ^ parseInt(colors[0].replace('#', '0x'))).toString(16)
    ).slice(-6)
  return colors
}

/**
 * 将图片文件转换为base64字符串
 * @param path 本地图片路径
 */
export function img2base64 (path: string): string {
  const buff = fs.readFileSync(path)
  return buff.toString('base64')
}

/**
 * 根据头像、用户名、爬取的文字生成打卡图片，返回图片的base64字符串
 * @param avatarPath 头像图片的本地路径
 * @param userName 用户名
 */
export async function generateImg (
  avatarPath: string,
  userName: string
): Promise<string> {
  const date: string = getDay() // 当前日期
  const words: string[] = await getJsonData(
    // 中英文每日一句
    'https://apiv3.shanbay.com/weapps/dailyquote/quote/',
    ['content', 'translation']
  )
  const colors: [string, string] = generateColors()
  return new Promise((resolve: any, reject: any) => {
    im('image/front.png')
      .background(colors[0]) // 背景颜色
      .mosaic() // 合成图层
      .draw(`image over 455,732 114,114 "${avatarPath}" `) // 绘制头像
      .fill('#ffffff') // 字体颜色
      .font(`${FONT_DIR}/经典隶变简.ttf`) // 字体
      .fontSize(38)
      .drawText(128, 550, splitChar(words[1], 20)) // 中文
      .fontSize(26) // 字体大小
      .drawText(0, 380, userName, 'Center') // 用户名
      .fontSize(26) // 字体大小
      .drawText(863, 160, getWeekDays()) // 星期
      .font(`${FONT_DIR}/Maecenas-ExtraLight.ttf`)
      .drawText(865, 100, `${date.slice(4, 6)} / ${date.slice(6, 8)}`) // 日期
      .fontSize(38)
      .drawText(128, 420, splitWords(words[0], 10)) // 英文
      .quality(100) // 质量最高
      .toBuffer('png', function (err, buffer) {
        if (err) {
          reject(err)
        } else {
          resolve(buffer.toString('base64'))
        }
      })
  })
}

/**
 * 获取当前日期 示例样式为20200725
 */
export function getDay (): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const M: string = m > 9 ? String(m) : '0' + String(m)
  const D: string = d > 9 ? String(d) : '0' + String(d)
  return `${y}${M}${D}`
}

/**
 * 获取当前星期
 */
function getWeekDays (): string {
  const date = new Date()
  const weekMap = [
    '星期天',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六',
  ]
  return weekMap[date.getDay()]
}

/**
 * 英文自动换行,指定换行的单词个数
 * @param str 需要换行的句子
 * @param num 每行的单词个数
 */
function splitWords (str: string, num: number): string {
  var pattern = new RegExp(`((?:(?:\\S+\\s){${num}})|(?:.+)(?=\\n|$))`, 'g')
  var result = str.match(pattern)
  return result ? result.join('\n') : ''
}

/**
 * 中文自动换行，指定换行的文字个数, 如果有逗号的话直接分割
 * @param str 需要换行的句子
 * @param len 每行的汉字个数
 */
function splitChar (str: string, len: number): string {
  var ret = []
  for (var offset = 0, strLen = str.length; offset < strLen; offset += len) {
    ret.push(str.slice(offset, len + offset))
  }
  return ret ? ret.join('\n') : ''
}

/**
 * 时间字符串转换为cron格式
 * @param str 时间字符串，格式示例：
 */
export function date2cron (str: string): string {
  const hour: string = str.split(':')[0]
  const minutes: string = str.split(':')[1]
  return `01 ${minutes} ${hour} * * *`
}
