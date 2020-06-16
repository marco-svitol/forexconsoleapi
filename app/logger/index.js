var winston = require('winston');
const format = require('winston');
require('winston-daily-rotate-file');
const moment = require('moment-timezone');
// Wrap Winston logger to print reqId in each log

const clshooked = require('cls-hooked');
const loggerNamespace = clshooked.getNamespace('logger');

var POSId = function() {
  const loggerNamespace = clshooked.getNamespace('logger');
  return `POS:${loggerNamespace.get('requestId')}`;//"99";//req.body.POSId;
};

const appendTimestamp = winston.format((info, opts) => {
  if(opts.tz)
    info.timestamp = moment().tz(opts.tz).format('DD-MM-YYYY HH:mm:ss:SSS').trim();
  return info;
});

const myCustomLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    verbose: 'magenta'
  }
};

var transportcombined = new(winston.transports.DailyRotateFile)({
  filename: '../logs/forexconsoleapi.%DATE%.log',
  datePattern: 'yyyy-MM-DD',
  level: process.env.LOGLEVEL_FILE,
  zippedArchive: true,
  maxSize: '5m',
  maxFiles: '10d'
})

var transporterror = new(winston.transports.DailyRotateFile)({
filename: '../logs/forexconsoleapi.error.%DATE%.log',
datePattern: 'yyyy-MM-DD',
level: 'error',
zippedArchive: true,
maxSize: '5m',
maxFiles: '10d'
})


winston.addColors(myCustomLevels.colors);

var logger = winston.createLogger({
  levels: myCustomLevels.levels,
  format: winston.format.combine(
    appendTimestamp({ tz: 'Europe/Rome' }),
    winston.format.colorize(),
    winston.format.printf(log => {
      PId = POSId();
      PId = PId?`${PId.padEnd(4,' ')} | `:'';
      msg = `${PId}${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(17, ' ')} | ${log.message}`;
      //msg = `${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(7, ' ')} | ${log.message}`;
      return msg;
    })
  ),
  transports: [
    transportcombined,
    transporterror,
    new winston.transports.Console({level: process.env.LOGLEVEL_CONSOLE})
  ]
});

module.exports=logger;