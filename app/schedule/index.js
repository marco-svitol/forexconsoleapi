var schedule = require('node-schedule');
const appConfig = require("../config/app.config.js");
const db = require("../database");
const logger=require('../logger'); 

function TrendsRecalc(msg, refreshonly){
  logger.info (msg)
  db._POSBalanceUpdateTrendsAll(refreshonly)
  logger.info (`Next schedule at ${this.nextInvocation()}`)
}

module.exports.TrendsRecalcDaylight = () => {
  schedule.scheduleJob(appConfig.TrendsRecalcDaylightFrequency, TrendsRecalc('Running scheduled job: TrendsRecalcDaylight', true));
}

module.exports.TrendsRecalcNightTime = () => {
  var nightrule = new schedule.RecurrenceRule();
  rule.dayOfWeek = [new schedule.Range(0, 6)];
  rule.hour = appConfig.TrendsRecalcNightTimeHour;
  rule.minute = 0;
  schedule.scheduleJob(nightrule, TrendsRecalc('Running scheduled job: TrendsRecalcNight', false));
}
