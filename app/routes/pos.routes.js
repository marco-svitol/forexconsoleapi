module.exports = myapp => {
  const pos = require("../logic/pos.logic");
  
  var router = require("express").Router();

  router.use(pos.verifyKey);
  router.post("/transactionsAdd", pos.transactionsAdd);
  router.post("/actionsGet", pos.actionsGet);
  router.post("/actionAck", pos.actionAck);
  myapp.use('/api/pos', router);
};