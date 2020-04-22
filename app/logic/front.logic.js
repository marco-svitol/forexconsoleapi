const appConfig = require("../config/app.config.js");
const db = require("../database");
const logger=require('../logger'); 
//const logger=require('winston');
const mysqlformat = require('mysql').format;
const jwt = require('jsonwebtoken');
var randtoken = require('rand-token')
var tokenproperties = appConfig.tokenproperties  //Token
var refreshTokens = {}
var usersrole = {}

exports.login = (req, res) => {  // Login Service //40ena!
  var username = req.body.username,
  password = req.body.password;
  if (username === null || password === null || username === '' || password ===''){return res.status(400).send("Bad request, check params please")}
  db._login(username,password, "web", function (err, lresult) {
    //res.setHeader('Access-Control-Allow-Origin', '*')
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
        res.status(200).send({ auth: true, token: token, refreshtoken: refreshToken});
      }else{ //if((loginmsg === 'disabled') or (loginmsg === 'notfound'))      {
        logger.warn(`Login failed for user ${username}: ${lresult}`);
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
      logger.debug("Succesfully fetched main view")
      res.status(200).json(main);
    }
  })
}

exports.maincashdeposit = (req, res) => {
  var currency = req.body.currency
  var amount = req.body.amount
  var exchangerate = req.body.exchangerate
  if (currency === null || currency === '' || amount === null ||  amount === '' || exchangerate === null ||  exchangerate ===''){return res.status(400).send("Bad request, check params please")}
  db._maincashdeposit(currency, amount, exchangerate, function (err, success, total) {
    if (err || !success){
      err?logger.error(`Maincashdeposit error: ${err}`):logger.error(`Maincashdeposit unsuccesfull`)
      res.status(500).send({ success: false, total: null});
    }else{
      logger.info(`Succesfully added ${amount} ${db._currency(currency)} with exchrate ${exchangerate} to maincashdeposit`)
      res.status(200).send({ success: true, total: total});
    }
  })
}

exports.action = (req, res) => {
  var action = req.body.action
  var POSId = req.body.POSId
  var currency = req.body.currency
  var amount = req.body.amount
  if (action === null || action === '' || POSId === null ||  POSId === '' || currency === null ||  currency ==='' || amount === null ||  amount ===''){return res.status(400).send("Bad request, check params please")}
  db._addAction(action, POSId, currency, amount, function (err, actionid) {
    if (err || !actionid){
      err?(logger.error(`Action ${action} error: ${err}`),res.status(500).send({ actionid: 0}))
        :(logger.warn(`Action ${action} action not added to queue..already there?`),res.status(200).send({ actionid: 0}))
    }else{
      logger.info(`Succesfully added Action ${action} action to queue with id ${actionid}`)
      res.status(201).send({ actionid: actionid});
    }
  })
}

exports.cancelAction = (req, res) => {
  var actionId = req.body.actionId
  if (actionId === null || actionId === ''){return res.status(400).send("Bad request, check params please")}
  db._cancelAction(actionId, function (err, actionid) {
    if (err || !actionid){
      err?(logger.error(`Action ${actionid} not cancelled error: ${err}`),res.status(500).send({ actionid: 0}))
      :(logger.warn(`Action ${actionid} cancel failed : was executed meanwhile?`),res.status(200).send({ actionid: 0}))
    }else{
      logger.debug(`Succesfully cencelled action ${actionid}`)
      res.status(200).send({ actionid: actionid});
    }
  })
}
exports.cancelCHFtransfer = (req, res) => {
}

