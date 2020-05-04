const dbConfig = require("../config/db.config.js");
const util = require('util');
const mysql = require('mysql');
const pool = mysql.createPool(dbConfig);
var randtoken = require('rand-token');
const mysqlformat = require('mysql').format;

pool.getConnection((err, conn) => {
  if (err){
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.')
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.')
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.')
    }
  }

  if (conn) {
    console.log(`Connected to ${dbConfig.database} DB on ${dbConfig.host}`)
    conn.release()
  }
  return
})

module.exports._login = function(username, password,role, next){
  let strQuery = `select active,${role}role as warole, role from systemusers where username = ? and password = sha1(?)`
  pool.query(strQuery, [username, password], (err,res) => {
    if (err) {
      next (err, "")
    }else{
      if (res.length > 0){
        if (res[0].active[0] == 1 && res[0].warole[0] == 1){
          next(null,{success: true, role: res[0].role}  );
        }else{
          next(null,{success: false, role: res[0].role, message: "disabled"});
        }
      }else{
        next(null,{success: false, role: '', message: "not found or wrong password"});
      }
    }
  })
}

module.exports._maincashdeposit = function (currency, amount, exchangerate, counterpartId, next) {
  let strQuery = `CALL pcpMainCashDeposit (?,?,?,?);`
  pool.query(strQuery, [currency, amount, exchangerate, counterpartId], (err,res) => {
    if (err) {
      return next (err, false)
    }else{
      if (res.length > 0){
        return next(null,res[1][0].success, res[1][0].total);
        }
      return next(null,false, null);
    }
  })  
}

module.exports._maincashwithdraw = function (currency, amount, counterpartId, actionId = 0, next) {
  let strQuery = `CALL pcpMainCashWithdraw (?,?,?,?);`
  pool.query(strQuery, [currency, amount, counterpartId, actionId], (err,res) => {
    if (err) {
      return next (err, false)
    }else{
      if (res.length > 0){
        return next(null,res[1][0].success, res[1][0].total);
        }
      return next(null,false, null);
    }
  })  
}

module.exports._addAction = function (action, POSId, currency, amount, next) {
  let strQuery = `CALL pcpPOSAddAction (?,"${action}",?,?);`
  pool.query(strQuery, [POSId, currency, amount], (err,res) => {
    if (err) {
      next (err, 0)
    }else{
      if (res.length > 0){
        if (res[0][0].actionid > 0){
          next(null,res[0][0].actionid);
          return;
        }
      }
      next(null,0);
    }
  })  
}

module.exports._cancelAction = async function (actionId, next) {
  //if action is sendtopos
  let newtotal = null
  //cQuery = 'SELECT a.action, q.POSActionParams FROM pcpPOSActionQueue q JOIN pcpActions a ON a.actionId = q.POSActionId WHERE q.POSActionQueueId = ?'
  cQuery = 'SELECT a.action, mc.transId FROM pcpPOSActionQueue q LEFT JOIN pcpActions a ON a.actionId = q.POSActionId LEFT JOIN pcpMainCashTransactions mc ON mc.actionId = ? WHERE q.POSActionQueueId = ?'
  pool.query(cQuery, [actionId, actionId], (err,ares) => {
    if (err) return next(err)
    if (ares.length == 0) return next(null,0)
    if (ares[0].action == 'sendtopos'){
      //extract params from JSON
      //params = JSON.parse(ares[0].POSActionParams)
      //this._maincashdeposit(params.currency, params.amount, params.exchrate, function(err, succ, depres){
      delQuery = 'CALL pcpMainCashDel(?)'
      pool.query(delQuery, [ares[0].transId], (err,delres) => {
        if (err) return next(err)
        newtotal = delres  
        let strQuery = `CALL pcpPOSCancelAction (?);`
        pool.query(strQuery, [actionId], (err,res) => {
          if (err) return next (err)
          if (res.length > 0){
            if (res[0][0].actionid > 0){
              return next(null,res[0][0].actionid, newtotal );
            }
          }else{
            return next(null,0);
          }
        })  
      })
    }
    let strQuery = `CALL pcpPOSCancelAction (?);`
    pool.query(strQuery, [actionId], (err,res) => {
      if (err) return next (err)
      if (res.length > 0){
        if (res[0][0].actionid > 0){
          return next(null,res[0][0].actionid, newtotal );
        }
      }else{
        return next(null,0);
      }
    })    
  })  
}

module.exports._mainview = function (next) {
  let strQuery = `CALL pcpMainView();`
  let i = 0
  pool.query(strQuery, (err,res) => {
    if (err) {
      next (err, 0)
    }else{
      if (res.length > 0){
        let main = [{}]
        let maindata = main[0]
        maindata["maincash"] = res[0]
        maindata["pos"] = res[1]
        let cleanactions = [{}]
        for (let actionitem of res[3]){
          actionitem = Object.assign({},actionitem, JSON.parse(actionitem.POSActionParams))
          cleanactions.push(actionitem)
        }
        for (let pos of maindata["pos"]){ //iterate on POS
          let poscash = res[2].filter(element => element.POSId == pos.POSId ) //filter for each POS
          pos["received"] = [{}]
          i = 0
          for (poscashrow of poscash){ //feed currency amounts and received
            pos[poscashrow.currency]      = poscashrow.totalamount
            pos["received"][i] = {}
            pos["received"][i]["currency"]   = poscashrow.currency
            pos["received"][i]["amount"]     = poscashrow.lastreceivedamount
            pos["received"][i]["timestamp"]  = poscashrow.lastreceivedtimestamp
            i += 1
          }
          pos["sendtopos"]  = cleanactions
                              .filter(element => element.POSId == pos.POSId && element.action == "sendtopos")
                              .map(({ POSId,action,POSActionId,POSActionParams, ...item }) => item)
          pos["CHFtransfer"] = cleanactions
                              .filter(element => element.POSId == pos.POSId && element.action == "CHFtransfer")
                              .map(({ POSId,action,POSActionId,POSActionParams, ...item }) => item)
        }
        //maindata["log"] = res[4]
        next(null, main)
      }else next(null,0);
    }
  })  
}

module.exports._alerts = function (params, next) {
  let whereand = ' WHERE al.acknowledged = 0 '
  if (params){
    if (params.POSId != null){whereand += ` AND POSId = ${params.POSId} `}
    if (params.severity != null){whereand += ` AND severity = ${params.severity} `}
    if (params.acknowledged != null){whereand += ` AND acknowledged = ${params.acknowledeged} `}
    if (params.transtype != null){whereand += ` AND transtype = ${params.transtype} `}
  }
  let strQuery = `SELECT al.alertId, al.timestamp, al.POSId, p.POSName as POSName, al.transtype, tt.name as transtypeName, al.currencyId, c.name, c.friendly, al.severity, s.severityDescription as severityDescription, acknowledged, emitter, alertmsg, transId, al.actionId, a.action as action 
  FROM pcpAlerts al
  LEFT JOIN POS p ON p.POSId = al.POSId
  LEFT JOIN transactionType tt ON tt.transTypeId = al.transtype
  LEFT JOIN pcpSeverity s ON s.severityId = al.severity
  LEFT JOIN pcpPOSActionQueue aq ON aq.POSActionQueueId = al.actionId
  LEFT JOIN pcpActions a on aq.POSActionId = a.actionId
  LEFT JOIN pcpCurrency c on c.currencyId = al.currencyId
  ${whereand} ORDER BY al.timestamp;`
  pool.query(strQuery, (err,res) => {
    if (err) return next(err)
    return next(null,res);
  })
}


//POS
module.exports._actionsGet = function (POSId, actionfilter, next) {
  var sqlQuery = 'call POSActionsGet(?,?);'
  pool.query(sqlQuery, [POSId, actionfilter], (err, res) => {
    if (err) {
      next(err, null)
    }else{
      next(null, res) 
    }
  })
}

module.exports._actionAck = function (POSId, POSActionQueueId, next) {
  var sqlQuery = 'call POSActionAck(?,?)'
  pool.query(sqlQuery, [POSId, POSActionQueueId], (err, res) => {
    if (err) {
      next(err, null)
    }else{
      next(null, res) 
    }
  })
}

function templateString(template, values){
  let output = template==null?'':template;
  Object.keys(values)
      .forEach(key => {
      output = output.replace(new RegExp(`\\{${key}\\}`, 'gi'), values[key]);
  });
  return output;
};

module.exports._addAlert = function (POSId, transtype, currencyId, severity, emitter, transId, actionId, messageName, messageVars, next) {
  //retrieve alertmsg template and fill it with params
  qGetAlertMsg = 'SELECT message FROM pcpAlertsDictionary WHERE messageName = ? AND lang = ?'
  
  pool.query(qGetAlertMsg, [messageName, 'IT'], (err, ares) => {
    if (err) return next(err)
    if (ares.length < 1) throw(`No alert message named ${messageName}`)
    alertmsg = templateString (ares[0].message, messageVars);
    var sqlQuery = 'call pcpAddAlert(?,?,?,?,?,?,?,?)'
    pool.query(sqlQuery, [POSId, transtype, currencyId, severity, emitter, transId, actionId, alertmsg], (err, res) => {
      if (err) {
        next(err, null)
      }else{
        if (res.length > 0){
          if (res[0][0].alertId > 0){
            next(null,res[0][0].alertId);
            return;
          }
        }
        next(null,0);
      }
    })
  })
}


module.exports._alertack = function (alertId, next) {
  ackQuery = "UPDATE pcpAlerts a SET a.acknowledged = 1 WHERE a.alertId = ? AND a.acknowledged = 0"
  pool.query(ackQuery, [alertId], function(err, res){
    if (err) return next(err)
    res.affectedRows != 1?next(null, 'alert already acknowledged or alert not exists'):next(null,'ok')
  }
  )
}

module.exports._currency = function (currencyId) {
  currency = [[1,"CHF"],[2,"EUR"],[3,"USD"],[25,"GBP"]]
  currencyMap = new Map(currency)
  return currencyMap.get(currencyId)
}

module.exports._refreshPOSTotals = function (POSId, next){
  var sqlQuery = 'CALL pcpUpdPOSCash(?);'
  pool.query(sqlQuery, POSId, (err, res) => {
    if (err) {
      return next(err, null)
    }else{
      return next(null,res)
    }
  })
}

module.exports._APIKeyGen = function (username, password, next){
  this._login(username, password, "addpos", function(err, res){
    if (err){
      return next(err)
    }else{
      if (res.success){
        //Generate APIKey
        let newAPIKey = randtoken.uid(50)
        return next(null,{APIKey: newAPIKey})
      }else{
        return next(null, {err: res})
      }
    }
  })
}

module.exports._AddPOS = function (POSCode, POSName, site, APIKey, next){
  var sqlQuery1 = 'SELECT POSName FROM POS WHERE POSName = ? AND ? <> POSCode;'
  pool.query(sqlQuery1, [POSName, POSCode], (err, res) => {
    if (err) return next(err)
    if (res.length > 0) {
      res.dupname = 1
      return next(null,res)
    }
    var sqlQuery2 = 'CALL POSAdd(?,?,?,?);'
    pool.query(sqlQuery2, [POSCode, POSName, site, APIKey], (err, res) => {
      if (err) {
        return next(err, null)
      }else if(res[0][0].new){
        //generate table entries for:  
            var bInsert = ''
            bInsert += `${mysqlformat(`INSERT INTO pcpPOSCash(POSId, currencyId) SELECT ?, currencyId FROM pcpCurrency;`, [res[0][0].POSId])}`
            bInsert += `${mysqlformat(`INSERT INTO forex_account_year(currency, account_year, POSId) 
            SELECT currencyId, YEAR(CURDATE()), ? FROM pcpCurrency WHERE currencyId <= 25;`, [res[0][0].POSId])}`
            pool.query(bInsert, (err) => {
              if (err) return next(err)
            })
            //Future implementations: forex_config forex_currency
        }
        return next(null,res[0][0])
    })
  })
}

module.exports._checkMainCash = function(currencyId, amount, next){
  chkQuery = 'SELECT amount FROM pcpMainCash WHERE currencyId = ?'
  pool.query(chkQuery, [currencyId], (err, res) => {
    if (err) return next(err, null)
    res[0].ok = true
    if (res[0].amount-amount<0) {res[0].ok=false}
    return next(null, res[0])
  })
}

module.exports._importPOSfromBackup = function(ForexDBName, POSId, fromDate, toDate, fromOid, toOid, deleteexisting, next){
  sqlQuery = 'CALL pcpImportForexDB(?,?,?)'
  pool.query(sqlQuery, [ForexDBName, POSId, fromDate], (err, res) => {
    if(err) return next(err)
    return next(null,res.affectedRows)
  })
}

module.exports._POSbalancetrend = function (POSIds,currencies,from,to, next){
  let whereand = ' WHERE 1 = 1 '
  let select = 'SELECT balancetime as timestep, _POSId as POSId, POSName, \`1\`,\`2\`,\`3\`,\`25\`,\`30\`,\`31\` '
  if (currencies != null){
    select = `SELECT balancetime as timestep, _POSId as POSId, POSName, `
    for (currency of currencies){
      select += `\`${currency}\`,`
    }
    select = select.slice(0, -1) + ' ';
  }
  if (POSIds != null){
    whereand += ` AND _POSId in (`
    for (POSId of POSIds){
      whereand += `${POSId},`
    }
    whereand = whereand.slice(0, -1) + ')';
  }
  if (from != null){whereand += ` AND balancetime >= '${from}' `}
  if (to != null){whereand += ` AND balancetime <= '${to}' `}
  
  let strQuery = `${select} FROM pcpPOSBalanceTrends bt JOIN POS p ON bt._POSId = p.POSId ${whereand} `
  
  pool.query(strQuery, (err,res) => {
    if (err) return next(err)
    return next(null,res);
  })
}

module.exports._POS = function(next){
  sqlQuery = 'SELECT POSId, POSName FROM POS'
  pool.query(sqlQuery, (err, res) => {
    if(err) return next(err)
    return next(null,res)
  })
}

pool.query = util.promisify(pool.query)

module.exports.pool = pool;