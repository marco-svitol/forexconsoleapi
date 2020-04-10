module.exports = myapp => {
  const pos = require("../logic/pos.logic");
  
  var router = require("express").Router();

  router.use("/",pos.verifyKey);
  router.post("/transactionAdd", pos.transactionAdd);
  router.post("/transactionDel", pos.transactionDel);
  router.post("/transactionUndel", pos.transactionUndel);
  router.post("/transactionWiD", pos.transactionWiD);
  router.post("/transactionDep", pos.transactionDep);
  /*router.get("/:id", tutorials.findOne);
  router.delete("/", tutorials.deleteAll);*/ 0
  myapp.use('/api/pos', router);
};