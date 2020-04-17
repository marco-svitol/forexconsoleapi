module.exports = {
  "appConfig": {
    "certpath": "../certs/ilciclaio512.crt",
    "privkeypath" : "../certs/ilciclaio_sha512.key",
    "certpw" : "",
    "listenport" : 8100,
    "importrootpath" : "../Backup",
    "dbusertable" : "cvusers",
    "dumpfilename"  : "forex_next.sql"
  },
  "tokenproperties": {
    "secret" : process.env.TOKENSECRET,
    "tokenTimeout": 3600,
    "refresh_tokenTimeout" : 172800
  }
}