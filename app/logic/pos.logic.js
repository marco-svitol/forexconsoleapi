const db = require("../database").pool;
const logger=require('winston');
const mysqlformat = require('mysql').format;

exports.verifyKey = (req,res,next) => {
  try{
    POSGet(req.body.apiAuth.POSCode, req.body.apiAuth.APIKey, (err,POSId) => {
      if(err){
        logger.error (" cannot process Auth info : " + err)
        POSId = 0
      }
      if (POSId === 0) {
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

function POSAdd(hostname, sn, manuf, site, next){
  let strQuery = 'call POSAdd(?,?,?,?,?)'
  db.query(strQuery, [hostname, sn, manuf, site, hostname], (err,res) => {
    if (err) {
      next (err, 0)
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
  for (var t of req.body.transactions){
    switch (t.transactionType) {
      case 0: //add
        var spcall = 'call POStransactionAdd(?,?,?,?,?,?,?,?,?,?,?,?)'
        var inserts = [t.oid,new Date().getFullYear(),t.forex_type,t.forex_oid,t.foreign_amount,t.exchange_rate,t.national_amount,t.journal_date_time,t.userId,t.isPOStransaction,req.body.POSId,t.transIsDeleted];
      break;
      case 1: //del
        var spcall = 'call POStransactionDel(?,?)'
        var inserts = [t.oid,req.body.POSId];
      break;
      case 2: //undel
        var spcall = 'call POStransactionUndel(?,?)'
        var inserts = [t.oid,req.body.POSId];
      break;
    }
    sqlQuery += `${mysqlformat(spcall, inserts)};`
  }
  db.query(sqlQuery, (err,qres) => {
    if (err) {
        logger.error("error processing transaction:" + err)
        res.status(500).send("Error while processing transactions");
    }else{
        var transSucc = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 1)
        var transFail = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 0)
        var mess = `Transcations processed ${transSucc.length}, not processed ${transFail.length}`
        logger.info(mess)
        res.status(200).send({added: transSucc.map(e => e[0]._oid), notadded: transFail.map(e => e[0]._oid)})  
    }
  })
}

exports.actionsGet = (req, res) => {

  

}

exports.transactionWiD = (req, res) => {
}

exports.transactionDep = (req, res) => {
}