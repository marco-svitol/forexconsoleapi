const appConfig = require("../config/app.config.js");
const db = require("../database");
const logger=require('../logger'); 
const jwt = require('jsonwebtoken');
var randtoken = require('rand-token')
var tokenproperties = appConfig.tokenproperties  //Token
var refreshTokens = {}
var usersrole = {}

exports.login = (req, res) => {  
  var username = req.body.username,
  password = req.body.password;
  if (username == null || password == null || username == '' || password ==''){return res.status(400).send("Bad request, check params please")}
  db._login(username,password, "web", function (err, lresult) {
    if (err) {
      logger.error("Login error:"+err);
      res.status(500).send("Error while logging in");
      return;
    }else{
      if (lresult.success){
        //req.session.username = username;
        logger.debug(`Login OK for user ${username}. Token expires in ${Math.round(tokenproperties.tokenTimeout / 6)/10} minutes`)      ;
        var token = jwt.sign({ id: username, role: lresult.role }, tokenproperties.secret, {
          expiresIn: tokenproperties.tokenTimeout
        });
        var refreshToken = randtoken.uid(256)
        refreshTokens[refreshToken] = username
        usersrole[username] = lresult.role
        res.status(200).send({ auth: true, token: token, refreshtoken: refreshToken, role: lresult.role});
      }else{
        lresult.message=='disabled'?
        db._addAlert(0,0, 0 , 2, 'login', 0, 0 , 'alert_loginfailed', {0: `${username}(${lresult.role})`, 1: " disabilitato"}, (err) => {if (err) logger.error(`Error saving alert ${err}`)})
        :
        db._addAlert(0,0, 0 , 2, 'login', 0, 0 , 'alert_loginfailed', {0: username, 1: " utente o password errati"}, (err) => {if (err) logger.error(`Error saving alert ${err}`)})
        logger.warn(`Login failed for user ${username}: ${lresult.message}`);
        res.status(401).send({ auth: false});
      }
    }
  })
}

//TODO: remove old refreshtoken + refreshtoken expiration
exports.refreshtoken = (req, res) => { 
  var username = req.body.username
  var refreshToken = req.body.refreshtoken
  if((refreshToken in refreshTokens) && (refreshTokens[refreshToken] == username)) {
    var token = jwt.sign({ id: username, role: usersrole[username]}, tokenproperties.secret, {
      expiresIn: tokenproperties.tokenTimeout
    });
    logger.debug(`Token refreshed for user ${username} : sending new token that will expire in ${Math.round(tokenproperties.tokenTimeout / 6)/10} minutes`);
    res.status(200).send({ auth: true, token: token})
  }
  else {
    logger.error(`Refresh token not available for user ${username}`);
    res.status(401).send({ auth: false});
  }
}

exports.logout = (req, res) => {
    req.session.reset();
    logger.info(req.session.user)
}

exports.main = (req, res) => {
  db._mainview(function (err, main) {
    if (err){
      logger.error(`Main view error: ${err}`)
      res.status(500).send("Error retrieving data");
    }else{
      logger.verbose("Succesfully fetched main view")
      res.status(200).json(main);
    }
  })
}

exports.maincashdeposit = (req, res) => {
  var currency = req.body.currency
  var amount = req.body.amount
  var exchangerate = req.body.exchangerate
  var counterpartId = req.body.counterpartId
  if (currency == null || currency == '' || amount == null ||  amount == '' || exchangerate == null ||  exchangerate ==''){return res.status(400).send("Bad request, check params please")}
  if (counterpartId == null) counterpartId = 1
  db._maincashdeposit(currency, amount, exchangerate, counterpartId, function (err, success, total) {
    if (err || !success){
      err?logger.error(`Maincashdeposit error: ${err}`):logger.error(`Maincashdeposit unsuccesfull`)
      res.status(500).send({ success: false, total: null});
    }else{
      logger.info(`Succesfully added ${amount} ${db._currency(currency)} with exchrate ${exchangerate} to maincashdeposit`)
      res.status(200).send({ success: true, total: total});
    }
  })
}

exports.maincashwithdraw = (req, res) => {
  var currency = req.body.currency
  var amount = req.body.amount
  var counterpartId = req.body.counterpartId
  if (currency == null || currency == '' || amount == null ||  amount == ''){return res.status(400).send("Bad request, check params please")}
  if (counterpartId == null) counterpartId = 1
  db._maincashwithdraw(currency, amount, counterpartId, 0, function (err, success, total) {
    if (err){
      err?logger.error(`Maincashwithdraw error: ${err}`):logger.error(`Maincashwithdraw unsuccesfull`)
      res.status(500).send({ success: false, total: null});
    }else if (!success){
      db._addAlert(0,0, 0 , 1, 'maincashwithdraw', 0, 0 , 'alert_notenoughmaincash', {0: amount, 1: total, 2: db._currency(currency)}, (err) => {if (err) logger.error(`Error saving alert ${err}`)})
      logger.warn(`Maincashwithdraw: not enough cash`)
      res.status(200).send({success: false, total: total, message: "notenough"});
    }
    else{
      logger.info(`Succesfully withdrawn ${amount} ${db._currency(currency)} from maincash`)
      res.status(200).send({ success: true, total: total});
    }
  })
}

exports.action = (req, res) => {
  var action = req.body.action
  var POSId = req.body.POSId
  var currency = req.body.currency
  var amount = req.body.amount
  if (action == null || action == '' || POSId == null ||  POSId == '' || currency =='' || amount == null ||  amount ==''){return res.status(400).send("Bad request, check params please")}
  if (action =='CHFtransfer'){currency = 1}
  //check if enough amount in MainCash
  if (['sendtopos'].includes(action)){
    db._checkMainCash(currency, amount, function(err,chkres){
      if(err){
        logger.error('Error while checking MainCash: ' + err)
        return res.status(500).send('Error while checking MainCash')
      }
      if (!chkres.ok){
        db._addAlert(0,0, 0 , 1, 'actionsendtopos', 0, 0 , 'alert_notenoughmaincash', {0: amount, 1: chkres.amount, 2: db._currency(currency)}, (err) => {if (err) logger.error(`Error saving alert ${err}`)})
        logger.warn(`Not enough ${db._currency(currency)} in MainCash: you asked for ${amount} and there's ${chkres.amount}`)
        //TODO: ConsoleAlert log
        return res.status(400).send({ actionid:0, message:'notenough', amountleft: chkres.amount });
      }
      db._addAction(action, POSId, currency, amount, function (err, actionid) {
        if (err || !actionid){
          err?(logger.error(`Action ${action} error: ${err}`),res.status(500).send({ actionid: 0}))
            :(logger.warn(`Action ${action} action not added to queue..already there?`),res.status(200).send({ actionid: 0}))
        }else{
          logger.info(`Succesfully added Action ${action} action to queue with id ${actionid}`)
          if (action == 'sendtopos'){
            //remove from maincashdeposit but check again before...async and multiple sessions...
            db._maincashwithdraw(currency, amount, POSId, actionid, function(err, success, total){
              if(err){
                logger.error('Error while withdrawing from MainCash: ' + err)
                return res.status(500).send('Error while withdrawing from MainCash')
              }
              if(!success){
                db._addAlert(0,0, 0 , 1, 'actionsendtopos', 0, 0 , 'alert_notenoughmaincash', {0: amount, 1: total, 2: db._currency(currency)}, (err) => {if (err) logger.error(`Error saving alert ${err}`)})
                logger.warn(`Not enough ${db._currency(currency)} in MainCash: you asked for ${amount} and there's ${total}`)
                return res.status(400).send({ actionid:0, message:'notenough', amountleft: total });
              }
              logger.debug(`Succesfully withdrawn ${amount} ${db._currency(currency)} from MainCash`)
              res.status(201).send({ actionid: actionid, message: 'ok', result: total});
            })
          }
        }
      })
    })
  }else{
    db._addAction(action, POSId, currency, amount, function (err, actionid) {
      if (err || !actionid){
        err?(logger.error(`Action ${action} error: ${err}`),res.status(500).send({ actionid: 0}))
          :(logger.warn(`Action ${action} action not added to queue..already there?`),res.status(200).send({ actionid: 0}))
      }else{
        logger.info(`Succesfully added Action ${action} action to queue with id ${actionid}`)
        res.status(201).send({ actionid: actionid, message: 'ok'});
      }
    })
  }
}

exports.cancelAction = (req, res) => {
  var actionid = req.body.actionId
  if (actionid == null || actionid == ''){return res.status(400).send("Bad request, check params please")}
  db._cancelAction(actionid, function (err, actionid, newtotal) {
    if (err || !actionid){
      err?(logger.error(`Action ${actionid} not cancelled error: ${err}`),res.status(500).send({ actionid: 0}))
      :(logger.warn(`Action ${actionid} cancel failed : was executed meanwhile?`),res.status(200).send({ actionid: 0})) //Warning Async Risk
    }else{
      logger.debug(`Succesfully cencelled action ${actionid}`)
      //verify if is "sendtopos" and in case redeposit amount
      res.status(200).send({ actionid: actionid, newtotal: newtotal });
    }
  })
}

exports.alerts = (req, res) => {
  db._alerts(req.body.params, function (err, alerts) {
    if (err){
      logger.error(`Alerts view error: ${err}`)
      res.status(500).send("Error retrieving data");
    }else{
      logger.verbose("Succesfully fetched alerts")
      res.status(200).json(alerts);
    }
  })
}

exports.alertack = function(req, res){
  db._alertack(req.body.alertId, function (err, succ) {
    if (err){
      logger.error(`Alert ${req.body.alertId} acknowledge error: ${err}`)
      res.status(500).send(`Error aknowledging alert ${req.body.alertId}`);
    }else{
      logger.info(`Succesfully acknowledged alert ${req.body.alertId}: ${succ}`)
      res.status(200).send({alertId: req.body.alertId, message: succ});
    }
  })
}

exports.importPOSfromBackup = function(req, res){
  //Import ForexDB transactions, forex_account_year from BackupDB
  // req: Source = ForexDBName, dest = POSId  options: delete all existing transactions
  db._importPOSfromBackup (req.body.ForexDBName, req.body.POSId, req.body.fromDate, req.body.toDate, req.body.fromOid, req.body.toOid, false, (err, nrows) =>{
    if (err) { 
      logger.error(`ImportPOSfromBackup error: ${err}`)
      return res.status(500).send(`ImportPOSfromBackup error: ${err}`)
    }
    logger.info(`ImportPOSfromBackup: ${req.body.ForexDBName} imported ${nrows} on POSId ${req.body.POSId}`)
    db._refreshPOSTotals(req.body.POSId, function(err){
      if (err){
        logger.error(`RefreshPOSTotal for POS ${req.body.POSId} failed: ${err}`)
      }else{
        logger.info(`RefreshPOSTotal for POS ${req.body.POSId} completed`)
      }
    })
    return res.status(200).send(`ImportPOSfromBackup: ${req.body.ForexDBName} imported ${nrows} on POSId ${req.body.POSId}`)
  })
}

exports.POSbalancetrend = function(req, res){
  db._POSbalancetrend (req.body.POSIds, req.body.currencies, req.body.from, req.body.to, (err, qres) => {
    if (err){
      logger.error(`Error retrieving POSbalancetrend : ${err}`)
      return res.status(500).send(`Error while retrieving data`)
    }
    logger.debug(`Retrieved POSbalancetrend`);
    return res.status(200).send(qres);
  })
}

exports.POS = function(req, res){
  db._POS ((err, qres) => {
    if (err){
      logger.error(`Error retrieving POS list : ${err}`)
      return res.status(500).send(`Error while retrieving POS list`)
    }
    logger.debug(`Retrieved POS list`);
    return res.status(200).send(qres);
  })
}


exports.deletePOS = function(req, res){
  
}
