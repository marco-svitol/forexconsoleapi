var winston = require('winston');
var httpContext = require('express-http-context');
// Wrap Winston logger to print reqId in each log
var reqId = function() {
  return httpContext.get('reqId');
};


//const deflogger = winston.createLogger({
winston.configure({  
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(log => {
      rId = reqId();
      msg = rId ? `${rId} | ${log.timestamp} | ${log.level}: ${log.message}` :  `${log.timestamp} | ${log.level}: ${log.message}`;
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
  winston.add(new winston.transports.Console()
  );
}

module.exports=winston;

