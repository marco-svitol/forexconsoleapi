module.exports = myapp => {
  const front = require("../logic/front.logic");

  var router = require("express").Router();

  router.post("/login", front.login);
  router.post("/logout", front.logout);
  router.get("/main", front.main);
  router.post("/maincashdeposit", front.maincashdeposit);
  router.post("/action", front.action);
  router.post("/cancelAction", front.cancelAction);

  myapp.use('/api/front', router);
};