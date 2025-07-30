import moment from "moment-timezone";
import chalk from "chalk";

export default class DepthsLogger {
  log(text: string) {
    console.log(this.format() + chalk.yellow('[LOG] ') + text)
  }

  info(text: string) {
    console.log(this.format() + chalk.hex('#a259f7')('[INFO] ') + text)
  }

  success(text: string) {
    console.log(this.format() + chalk.green('[SUCCESS] ') + text)
  }

  error(err: Error | string, type: string = 'ERROR') {
    if (typeof err === 'string') {
      return console.log(this.format() + chalk.red(`[${type}] `) + err)
    } else {
      return console.log(this.format() + chalk.red(`[${type}] `) + `${err.name}: ${err.message}\n${err.stack}`)
    }
  }

  private format() {
    const time = moment(Date.now()).tz('Europe/Moscow').locale('ru-RU')
    return chalk.cyan(`[${time.format('DD.MM.YYYY')} | ${time.format('HH:mm:ss')}] `)
  }
}
