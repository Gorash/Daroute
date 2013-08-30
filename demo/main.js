var Daroute = require('../lib/Daroute');
var Exception = Daroute.Exception;

// define log level
Daroute.logger.level = 2;

// define a new logger
var logger = new Daroute.builderLogger("main.js", {level: 4});

// launch server with handler
require('http').createServer(Daroute.handler).listen(8080);
logger.info('Server running at http://127.0.0.1:8080/');


// define a path for the routes
Daroute.addPathRegExp('IPv4', '[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}', function (val) {
  val = val.split(".");
  for (var k in val) {
    val[k] = parseInt(val[k]);
  }
  return val;
});
Daroute.addException("MyCustomError", 401, 'error');


// define route with custom exeption
Daroute.onBegin = function () {
  console.log("onBegin eg.: DB connexion");
};
Daroute.onSuccess = function () {
  console.log("onSuccess DB commited");
};
Daroute.onUnsuccess = function () {
  console.log("onUnseccess DB roolback");
};


// define static route
Daroute.add('/static/<path>', false);

// define route
// try with http://127.0.0.1:8080
Daroute.add('/', '/index', function index (request, response) {
  logger.info(request.params);
  response.writeHead(200);
  response.end("index");
});

// define route with custom exeption
// try with http://127.0.0.1:8080/168.192.33.65 or http://127.0.0.1:8080/18
Daroute.add('/<IPv4:bobo>', '/<int:bobo>', function IPv4 (request, response) {
  logger.info(request.params);
  throw new Exception.MyCustomError(request.params.route);
});


// define a callback for a custom exeption
Daroute.onException('NotFound', function NotFound (request, response) {
  response.writeHead(request.error.type);
  response.end("new content for error");
});

