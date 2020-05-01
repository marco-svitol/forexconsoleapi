var winston = require('winston');
const format = require('winston');
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

//const deflogger = winston.createLogger({
winston.configure({  
  level: 'info',
  format: winston.format.combine(
    appendTimestamp({ tz: 'Europe/Rome' }),
    //winston.format.timestamp(),
    winston.format.printf(log => {
      PId = POSId();
      PId = PId?`${PId.padEnd(4,' ')} | `:'';
      msg = `${PId}${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(7, ' ')} | ${log.message}`;
      //msg = `${log.timestamp.padEnd(23,' ')} | ${(''+log.level+'').padEnd(7, ' ')} | ${log.message}`;
      return msg;
    })
  ),
  //defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: '../logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../logs/combined.log' })
  ]
});
// If we're not in production then log also to the `console` 
if (process.env.NODE_ENV !== 'production') {
  winston.add(new winston.transports.Console({level: 'debug'})
  );
}

module.exports=winston;