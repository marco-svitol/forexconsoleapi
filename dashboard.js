const dotenv = require('dotenv');
dotenv.config();
const appConfig = require(__dirname + "/app/config/app.config.js");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json()); // parse requests of content-type - application/json
app.use(bodyParser.urlencoded({ extended: true })); // parse requests of content-type - application/x-www-form-urlencoded
var uuid = require('uuid');
var httpContext = require('express-http-context');
const unless = require('express-unless');
const jwt = require('jsonwebtoken');

app.use(httpContext.middleware);

app.use(function(req, res, next) { // Run the context for each request. Assign a unique identifier to each request
    httpContext.set('reqId', uuid.v1());
    next();
});
checkJWT.unless = unless;   //use "unless" module to exclude specific requests for CheckJWT
// Use JWT auth to secure the API
app.use(checkJWT.unless({path: ['/api/front/login','/api/pos/transactionAdd','/api/pos/transactionDel']}))//,'/api/front/maincashdeposit','/api/front/action','/api/front/main','/api/pos/transactionAdd']}))

const cors = require("cors");
var corsOptions = {
  origin: "http://localhost:8081"

};
app.use(cors(corsOptions));

var logger=require('./app/logger'); 

function srvconsoledir(request, start=1, err = 0){ //internal: log service call info to console
  let params = ""
  if (err==0){
    if (start){
      if (Object.keys(request.body).length != 0){
        params = JSON.stringify(request.body)
        if (request.path.includes('login')){params = 'for user ' + request.body.username}
      }else{
        params = JSON.stringify(request.query)
      }
      logger.info(`${request.path} service request ${params}`)
      //perfy.start(rTracer.id())
    }
    else{
      //let perfSecs = perfy.end(rTracer.id())['time']
      //let perfMsg = `${perfSecs} secs`
      //if ((config_data.log.thresholdProcessTimeWarning < perfSecs) && (perfSecs < config_data.log.thresholdProcessTimeAlert)) {perfMsg = `${perfMsg} LatencyWarning` }
      //else if (perfSecs > config_data.log.thresholdProcessTimeAlert) {perfMsg = `${perfMsg} LatencyAlert` }
      logger.info(`${srvname} service completed for ${request.connection.remoteAddress}`)}}// in ${perfMsg}`)}}
  else{
    logger.error(`${srvname} service requested from ${request.connection.remoteAddress} raised this error: ${JSON.stringify(err)}`)
    //perfy.end(rTracer.id())
    }
}

function checkJWT(request, response, next) { //Function used by Router to verify token
  if (request.headers.authorization) {// check headers params
    logger.info (request.headers.authorization)
    jwt.verify(request.headers.authorization, appConfig.tokenproperties.secret, function (err, decoded) {  // check valid token
      if (err) {
        logger.error("CheckJWT failed: not authorized");
        response.statusMessage = 'You are not authorized';
        return response.status(401).send('You are not authorized')
      } else {
        //console.log (decoded);
        next()}
    })
  } else {
    logger.error("CheckJWT failed: not authorized");
    response.statusMessage = 'You are not authorized';
    return response.status(401).send('You are not authorized')//json({message:'You are not allowed'})
  }
}

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to MondialChangeAPI" });
});

app.use((req,res,next) => {
  srvconsoledir(req);
  next();
})

require("./app/routes/pos.routes")(app);
require("./app/routes/front.routes")(app);

// set port, listen for requests
app.listen(process.env.SERVER_PORT, () => {
  logger.info(`Server is running on port ${process.env.SERVER_PORT}.`);
});