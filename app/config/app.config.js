module.exports = {
  "appConfig": {
    "certpath": "../certs/ilciclaio512.crt",
    "privkeypath" : "../certs/ilciclaio_sha512.key",
    "certpw" : "",
    "listenport" : 8100,
    "importrootpath" : "../Backup",
    "dbusertable" : "cvusers",
    "dumpfilename"  : "forex_next.sql"
    //,"TrendsRecalcDaylightFrequency" : "0 6-22 * * *",
    //"TrendsRecalcNightTimeHour" : "4"
  },
  "tokenproperties": {
    "secret" : process.env.TOKENSECRET,
    "tokenTimeout": 7200,
    "refresh_tokenTimeout" : 172800
  }
}