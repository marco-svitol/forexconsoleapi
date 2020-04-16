const dbConfig = require("../config/db.config.js");
const util = require('util')
const mysql = require('mysql');
const pool = mysql.createPool(dbConfig);

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
          next(null,{success: true, role: res[0].warole[0]}  );
        }else{
          next(null,"disabled");
        }
      }else{
        next(null,"notfound");
      }
    }
  })
}

module.exports._maincashdeposit = function (currency, amount, exchangerate, next) {
  let strQuery = `CALL pcpMainCashDeposit (?,?,?);`
  pool.query(strQuery, [currency, amount, exchangerate], (err,res) => {
    if (err) {
      next (err, false)
    }else{
      if (res.length > 0){
        if (res[0]){
          next(null,true);
          return;
        }
      }
      next(null,false);
    }
  })  
}

module.exports._addAction = function (action, POSId, currency, amount, next) {
  let strQuery = `CALL pcpPOSAddAction (?,"${action}",?,?);`
  //const actionparams  = `{"currency" : "${currency}","amount" : ${amount}}`
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

module.exports._cancelAction = function (POSId, actionId, next) {
  let strQuery = `CALL pcpPOSCancelAction (?,?);`
  pool.query(strQuery, [POSId, actionId], (err,res) => {
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
        maindata["log"] = res[4]
        next(null, main)
      }else next(null,0);
    }
  })  
}


pool.query = util.promisify(pool.query)

module.exports.pool = pool;