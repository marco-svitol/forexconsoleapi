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
        /* POSAdd(req.body.POS.cn,req.body.POS.sn,req.body.POS.vendor,req.body.POS.site,function(err, POSId){
          if(err && POSId > 0) throw(err)
          logger.info('PSAction: added POSId '+POSId)
          req.body.POSId = POSId;
          POSlogHeartBeat(POSId);
          next()
        }) */
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

exports.transactionAdd = (req, res) => {
  let sqlQuery = ''
  let transTot = req.body.transactions.length
  let spcall = 'call POStransactionAdd(?,?,?,?,?,?,?,?,?,?,?,?)'
  for (var t of req.body.transactions){
    var inserts = [t.oid,new Date().getFullYear(),t.forex_type,t.forex_oid,t.foreign_amount,t.exchange_rate,t.national_amount,t.journal_date_time,t.userId,t.isPOStransaction,req.body.POSId,t.transIsDeleted];
    sqlQuery =sqlQuery + `${mysqlformat(spcall, inserts)};`
  }
  db.query(sqlQuery, (err,qres) => {
    if (err) {
        logger.error("error adding transaction:" + err)
        res.status(500).send({
          message: "Error adding transaction: " + err
        });
    }else{
      //(if (qres.length == transTot){
        var transSucc = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 1)
        var transFail = qres.filter(element => element[0] != undefined).filter(element => element[0].result == 0)
        var mess = `Transcations added ${transSucc.length}, not added ${transFail.length}`
        logger.info(mess)
        res.status(200).send({added: transSucc.map(e => e[0]._oid), notadded: transFail.map(e => e[0]._oid)})  
      /*}else{
        var transDup = qres.filter(element => element.length == 1)
        var mess = `Added ${transTot-transDup.length}/${transTot} transactions. Duplicates transactions: ${transDup.map(tr => tr[0]._oid)}, ${transDup.map(tr => tr[0]._journal_date_time)}`
        logger.error(mess)
        res.status(200).send({added: transTot -transDup.length, duplicates: transDup.map(tr => tr[0]._oid)}) 
      }*/
    }
  })
}


exports.transactionDel = (req, res) => {
  let sqlQuery = ''
  let delsTot = req.body.deletes.length
  let spcall = 'call POStransactionDel(?,?,?,?,?)'
  for (var t of req.body.deletes){
    var inserts = [t.oid,t.journal_date_time,t.userID,req.body.POSId,t.username];
    sqlQuery =sqlQuery + `${mysqlformat(spcall, inserts)};`
  }
  db.query(sqlQuery, (err,qres) => {
    if (err) {
        logger.error("error removing transaction:" + err)
        res.status(500).send({
          message: "Error removing transaction: " + err
        });
    }else{
      if (qres.length == delsTot){
        var mess = `Deleted ${delsTot}/${delsTot} transactions`
        logger.info(mess)
        res.status(200).send({Del: delsTot, notDel: null})  
      }else{
        var notDel = qres.filter(element => element.length == 1)
        var mess = `Deleted ${delsTot-notDel.length}/${delsTot} transactions. Not deleted transactions: ${notDel.map(tr => tr[0]._oid)}, ${notDel.map(tr => tr[0]._journal_date_time)}`
        logger.error(mess)
        res.status(200).send({Del: delsTot - notDel.length, notDel: notDel.map(tr => tr[0].deltransid)}) 
      }
    }
  })
}

exports.transactionUndel = (req, res) => {
  let sqlQuery = ''
  let spcall = 'call POStransactionUndel(?,?,?,?,?)'
  var inserts = [req.body.oid,req.body.journal_date_time,req.body.userID,req.body.POSId,req.body.username];
  sqlQuery =sqlQuery + `${mysqlformat(spcall, inserts)};`
  db.query(sqlQuery, (err,qres) => {
    if (err) {
      logger.error("error undeleting transaction:" + err)
      res.status(500).send({
        message: "Error undeleting transaction: " + err
      });
    }else{
      var mess = `UnDeleted transId ${qres[0][0].undeltransid}`
      logger.info(mess)
      res.status(200).send({Undel: `${qres[0][0].undeltransid}` })  
    }
  })
}

exports.transactionWiD = (req, res) => {
}

exports.transactionDep = (req, res) => {
}