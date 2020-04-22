module.exports = myapp => {
  const pos = require("../logic/pos.logic");
  const unless = require('express-unless');
  var router = require("express").Router();

  pos.verifyKey.unless = unless;
  router.use(pos.verifyKey.unless({path: ['/api/pos/register']}));
  router.post("/transactionsAdd", pos.transactionsAdd);
  router.post("/actionsGet", pos.actionsGet);
  router.post("/actionAck", pos.actionAck);
  router.post("/register", pos.register);
  myapp.use('/api/pos', router);
};