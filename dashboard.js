const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json()); // parse requests of content-type - application/json
app.use(bodyParser.urlencoded({ extended: true })); // parse requests of content-type - application/x-www-form-urlencoded
const logger=require('./app/logger'); 
const cors = require("cors");

/*var corsOptions = {
  origin: "http://localhost:8081"

};
app.use(cors(corsOptions));*/
app.use(cors());

// default
app.get("/", (req, res) => {
  res.json({ message: "Welcome to MondialChangeAPI" });
});

app.use(function(req, res, next) { // Run the context for each request. Assign a unique identifier to each request
    if (Object.keys(req.body).length != 0){
      params = JSON.stringify(req.body)
      if (req.path.includes('login')){params = 'for user ' + req.body.username}
    }else{
      params = JSON.stringify(req.query)
    }
    logger.debug(`${req.path} service request ${params}`)
    next();
});

require("./app/routes/pos.routes")(app);
require("./app/routes/front.routes")(app);

// set port, listen for requests
app.listen(process.env.SERVER_PORT, () => {
  logger.info(`Server is running on port ${process.env.SERVER_PORT}.`);
});

