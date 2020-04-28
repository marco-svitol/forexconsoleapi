const db = require("../database").pool;
const store = require("../database");
const logger=require('../logger');  
const mysqlformat = require('mysql').format;

exports.verifyKey = (req,res,next) => {
  logger.info (req.body.apiAuth.POSCode)
  try{
    POSGet(req.body.apiAuth.POSCode, req.body.apiAuth.APIKey, (err,POSId) => {
      if(err){
        logger.error (" cannot process Auth info : " + err)
        POSId = 0
      }
      if (POSId == 0) {
        logger.warn("POS not authorized or APIKey is invalid")
          res.status(401).send("POS not authorized or APIKey is invalid");
      }else{
        req.body.POSId = POSId;
        POSlogHeartBeat(POSId);
        next();
      }
    })
  }catch(err){
    logger.error (" cannot process Auth info : " + err)
    res.status(401).send("POS not authorized or APIKey is invalid");
  }
}

function POSGet(POSCode, APIKey , next){
  let strQuery = 'call POSGet(?,?)'
  db.query(strQuery, [POSCode, APIKey], (err,res) => {
    if (err) {
      next(err,0)
    }else{
      if (res[0].length > 0){
        next(null,res[0][0].POSId);
      }else{
        next(null,0);
      }
    }
  })
}

function POSlogHeartBeat(POSId){ 
  let strQuery = 'call POSlogHeartBeat(?)'
  db.query(strQuery, [POSId], (err) => {
    if (err) {
      logger.error(`Error while logging heartbeat for POSId ${POSId} : ` + err)
    }  
  })
}

exports.transactionsAdd = (req, res) => {
  let sqlQuery = ''
  for (var item of req.body.transactions){
    let t = item.Transaction;
    switch (item.IDU) {
      case "I": //add
        var spcall = 'call POStransactionAdd(?,?,?,?,?,?,?,?,?,?,?)'
        var inserts = [t.oid,new Date().getFullYear(),t.forex_type,t.forex_oid,t.foreign_amount,t.exchange_rate,t.national_amount,t.journal_date_time,t.userID,t.isPOStransaction,req.body.POSId];
      break;
      case "D": //del
        var spcall = 'call POStransactionDel(?,?)'
        var inserts = [t.oid,req.body.POSId];
      break;
      case "U": //undel
        var spcall = 'call POStransactionUndel(?,?)'
        var inserts = [t.oid,req.body.POSId];
      break;
    }
    sqlQuery += `${mysqlformat(spcall, inserts)};`
  }
  if (sqlQuery == '') return;
  db.query(sqlQuery, (err,qres) => {
    if (err) {
        logger.error("error processing transaction:" + err)
        res.status(500).send("Error while processing transactions");
    }else{
      qresclean = qres.filter(element => element[0] != undefined)
      responselist = req.body.transactions.map( ({QId}, e) => ({QId, added : qresclean[e][0].result}) )
      /*function( {QId}, e ){return ({QId, added : qresclean[e][0].result})}*/

      var transSucc = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 1)
      var transFail = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 0)

      logger.info(`Transactions processed ${transSucc.length}, not processed ${transFail.length}`)
      res.status(200).send(responselist)
      logger.debug(`Oid processed: ${transSucc.map(e => e[0]._oid).toString()}, trans failed ${transFail.map(e => e[0]._oid).toString()}`)

      //-------Run deposit action matching

      logger.info("Running deposit matching")
      //Step1 (transaction objs): filter Deposit and successfully added transactions only
      var tdeposit = req.body.transactions.filter(function(t) {
        // checking failed transaction does not contain oid
        if(transFail.indexOf(t.Transaction.oid) == -1 && t.Transaction.forex_type == 3)
          return true;
        else
          return false;
      });
      //Step2 (action objs): check if there is any 'sendtopos' action for this specific POSId
      logger.debug(`-Step1: Found ${tdeposit.length} succesfull deposit transactions`)
      if (tdeposit.length > 0){
        store._actionsGet (req.body.POSId, 'sendtopos', function (err, filteredactions){
          if (err) {
            logger.error("Error retrieving POS actions while matching deposit transaction: " + err)
            //TODO: manage error!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
          }else{
            logger.debug(`--Step2: Fetched ${filteredactions.length} 'sendtopos' actions for POSId ${req.body.POSId}`)
            if (filteredactions.length > 0){
              //Step3 (actions vs trans): match transactions and actions based on currency
              for (action of filteredactions[0]){
                params = JSON.parse(action.POSActionParams)
                tmatch = tdeposit.filter(t => t.Transaction.forex_oid == params.currency)
                logger.debug(`---Step3: Matched ${tmatch.length} transactions vs actions having same currency `)
                if (tmatch.length > 0){
                  //sum all transactions before matching
                  const totaldeposit = tmatch.reduce((a, b) => +a + +b.Transaction.foreign_amount, 0);
                  if (totaldeposit != params.amount){
                    logger.warn(`----Step4: Amount NOT matching. Pulling action but raising a console alert`)
                    store._addAlert(req.body.POSId, 3, params.currency , 3, 'transactionsAdd', tmatch[0].Transaction.oid, action.POSActionQueueId , 'alert_sendtoposmismatch', {0: store._currency(params.currency), 1: params.amount, 2: totaldeposit}, (err,qres) => {
                      if (err) {
                        logger.error ("-----Step4: error while logging alert: "+err)
                      }else{
                        logger.warn(`-----Step4: Alert ${qres} added to console`)
                      }
                    })
                  }else{
                    logger.info(`----Step4: Amount matching. Removing action silently`)
                  }
                  //remove action
                  store._actionAck (req.body.POSId, action.POSActionQueueId , function (err, qres){
                    if (err || qres.length == 0) {
                      logger.error("-----Step5: Error pulling sendtopos action from queue:" + err)
                    }else{
                      logger.debug(`-----Step5: Action sendtopos with id ${action.POSActionQueueId} pulled from queue`)
                    }
                  })
                }
              }
            }
          }
        })
      }        
    }
    //-------Refresh totals for this POS
    store._refreshPOSTotals(req.body.POSId, function(err, res){
      if (err){
        logger.error(`RefreshPOSTotal for POS ${req.body.POSId} failed: ${err}`)
      }else{
        logger.info(`RefreshPOSTotal for POS ${req.body.POSId} completed`)
      }
    })
  })
}

exports.actionsGet = (req, res) => {
  store._actionsGet (req.body.POSId, null , function (err, qres){
    if (err) {
      logger.error("error retrieveing POS actions:" + err)
      res.status(500).send("Error while retrieving POS actions");
    }else{
      let fres = qres[0].filter(e => e.action != 'sendtopos')
      logger.debug(`Fetched ${fres.length} actions after filtering`)
      res.status(200).send(fres)  
    }
  })
}

exports.actionAck = (req, res) => {
  store._actionAck (req.body.POSId, req.body.actionAck.POSActionQueueId, function (err, qres){
    if (err || qres.length == 0) {
      logger.error("error pulling POS action from queue:" + err)
      res.status(500).send("Error while pulling POS action");
    }else{
      logger.info(`Action ${req.body.actionAck.POSActionQueueId} acknowledged`)
      res.status(200).send()
    }
  })
}

exports.register = (req,res) => {
  store._APIKeyGen(req.body.username, req.body.password, function(err, kgres){
    if (err){
      logger.error(`Error generating APIKey for user ${req.body.username} :` + err)
      return res.status(500).send(`Error generating APIKey for user ${req.body.username}`)
    }else{
      if (!kgres.err){
        store._AddPOS (req.body.POSCode, req.body.POSName, req.body.site, kgres.APIKey, (err, apres) => {
          if (err){
            logger.error(`Error adding POS for site ${req.body.site}. POSCode is ${req.body.POSCode}. ` + err)
            return res.status(500).send(`Error adding POS for site ${req.body.site}. User and password are OK but something went wrong on server side. Sorry.`);
          }else{
            if (apres.dupname){
              logger.warn(`POSName ${req.body.POSName} already exists, please choose another name`)
              return res.status(400).send(`POSName ${req.body.POSName} already exists, please choose another name`)
            }
            else if (apres.new){
              logger.info(`New POS for site ${req.body.site} added succesfully. APIKey is: ${kgres.APIKey}`)
            }else{
              logger.info(`POS for site ${req.body.site} was already registered. New APIKey is: ${kgres.APIKey}`)
            }
            return res.status(201).send({new: apres.new, APIKey: kgres.APIKey})
          }
        })
      }else{
        logger.error(`Cannot generate APIKey: user ${kgres.err}`)
        return res.status(401).send(`Cannot generate APIKey: user ${kgres.err}`)
      }
    }
  })
}


