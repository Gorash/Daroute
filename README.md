Daroute.js
==========

## Introduction

Daroute is a node.js routing module and path analizer module.
Daroute can
* define simple routes (route dynamique or static)
* define types of path arguments and callback (by default: int, float, list_int...)
* find the most complex route (nb of types + nb of args + number of "/"), if no route found throw a NotFound error
* define new mineType used to serve static files
* trigger for onBegin before call a route method
* trigger for onEnd method if they are no error in the route method
* trigger for onError method if they are a least one error catched in the route method
* define custom errors
* handle error
* complete and colored console log

Here is an example on how to use it:

```js
var Daroute = require('Daroute');

// define a new logger (level 4 = display debug, info, warning and error log)
var logger = new Daroute.builderLogger("main.js", {level: 4});

// launch server with handler
require('http').createServer(Daroute.handler).listen(8080);
logger.info('Server running at http://127.0.0.1:8080/');


// add a new path parser for the routes
Daroute.addPathRegExp('user', 'user-[0-9]*', function user_parser (value) {
  var id = parseInt( value.split("-")[1] );
  // eg. select in DB
  // ... if the user haven't access: throw new Daroute.Exception.AccessDenied("User %s is not logged", id);
  // ...
  return id;
});


// define static route
Daroute.add('/static/<path>', false);

// define route
// try with http://127.0.0.1:8080
Daroute.add('/', '/index', function index (request, response) {
  response.writeHead(200);
  response.end("index");
});

// define route with custom exeption
// try with http://127.0.0.1:8080/user-65
Daroute.add('/<user:bobo>', function user_route (request, response) {
  // request.params contain: { get: {}, route: { bobo: 65 }, post: {} }
  response.writeHead(200);
  response.end("user id = " + request.params.route.bobo);
});
```

## add routes and routes for static files

When a user arrive on this adresse path, Daroute found the most complex route, if no route found throw a NotFound error.
If Daroute found a route, the callback is false, the path is served like a static files.
You can add some variable parts in the route. The variable parts are content between &lt; and &gt; (Eg. &lt;toto&gt; ).
The variable parts can be defined a specific type predefined (Eg. &lt;int:toto&gt; ).
Diffrents types already available: int, float, hexa, alnum, path, list_int, but you can defined your specific parser for your custom types.

All route are sorted by complexity (by default: int, float, list_int...). The experts can redefined they custom Daroute.sort method.

Arguments is on request.params
* request.params.route: Arguments from the route
* request.params.get :  Arguments from the querystring
* request.params.post : Arguments from the post form (use enctype='multipart/form-data' for your HTML form)

```js
Daroute.add('/my/route/<int:lou>/<bobo>/truc<list_int:pepe>', function test (request, response) { 
   response.writeHead(200);
   response.end("Hello Word !"); 
});
// try with http://127.0.0.1:8080/my/route/55/--*98fs+%20--/truc5,6,8,78
// request.params contain { get: {}, route: {lou: 55, bobo: '--*98fs+%20--', pepe: [5,6,8,78]}, post: {} }
```

### route are sorted by complexity

```js
Daroute.add('/my/route/<lou>', function lou1 (request, response) { 
   response.writeHead(200);
   response.end("Hello Word !"); 
});
Daroute.add('/my/route/<int:lou>', function lou2 (request, response) { 
   response.writeHead(200);
   response.end("Hello Word !"); 
});
// try with http://127.0.0.1:8080/my/route/55
// lou2 is called and request.params.route.lou is an integer with a value = 55
```

### defined your specific parser for your custom types

```js
// add a new path parser for the routes
Daroute.addPathRegExp('user', 'user-[0-9]*', function user_parser (value) {
  var id = parseInt( value.split("-")[1] );
  // eg. select in DB
  // ... if the user haven't access: throw new Daroute.Exception.AccessDenied("User %s is not logged", id);
  // ...
  return id;
});

// define route with custom exeption
Daroute.add('/<user:bobo>/<user:user>', function user_route (request, response) {
  response.writeHead(200);
  response.end("user id = " + request.params.route.bobo);
});
// try with http://127.0.0.1:8080/user-65/user-45?user=77
// request.params contain: { get: {user: '77'}, route: { bobo: 65, user: 45 }, post: {} }
```

## onBegin, onEnd, onError

Daroute call all your onBegin method before call a route method
Daroute call all your onEnd method if they are no error in the route method
Daroute call all your onError method if they are a least one error catched in the route method

```js
Daroute.onBegin(function DB_open () {
  // eg. open your DB and begin a transaction
  // ...
  console.log("onBegin opening");
});
Daroute.onEnd(function DB_commited () {
  // eg. commit your data's transaction into your DB
  // ...
  console.log("onSuccess commited");
});
Daroute.onError(function DB_roolback () {
  // eg. roolback your transaction
  // ...
  console.log("onUnseccess roolback");
});
```

## Errors handler

Define your custom errors to simplify and improve security of your application and get a good log.
When we throw a custom error, two log are created.
* log with level defined, name, date and content of your error.
* debug log display the traceback of your error

All non custom errors or predefined errors (BadRequest, ValueError, TypeError, AccessError, AccessDenied, NotFound), are logged with error level and contain the traceback

```js
Daroute.addException("MyCustomError", 401, 'error');

// define a callback for a custom exeption
Daroute.onException('MyCustomError', function MyCustomError (request, response) {
  response.writeHead(request.error.type);
  response.end("new content for error");
});

// In your route
throw new Daroute.Exception.MyCustomError("Message to return for the log. You can use %s, or the arguments is added at the end", data, other_data);
```

## Logger

* Colored message in your console
* 4 log levels : 'error', 'warn', 'info', 'debug'
* Arguments are converted with util.format and logged with console.log
* Defined the minimal log level to display

The log displayed content:
* date (white color)
* logger name (blue color)
* log level (color in function of level)
* message & data

```js
// define a new logger (level 3 = display debug, info, warning and error log)
var logger1 = new Daroute.builderLogger("main.js", {level: 3});
// define a new logger (level 1 = display warning and error log)
var logger2 = new Daroute.builderLogger("other app", {level: 1});

logger1.debug('Debug message and data');
// console: 2013-09-28 13:46:08 main.js - DEBUG - Debug message and data
logger1.info('Informations eg. %s', 55, {'yep': 44});
// console: 2013-09-28 13:46:08 main.js - INFO - Informations eg. 55 { yep: 44 }
logger2.info('Informations');
// nothing displayed
logger2.warn('Warning message');
// console: 2013-09-28 13:46:08 other app - WARN - Warning message
logger2.log('error', 'Error message');
// console: 2013-09-28 13:46:08 other app - ERROR - Error message
```

## MineType

The list of mineTypes is defined in mineType.data
You can defined your mineType in your application

```js
Daroute.getMineType("file.js")
// return "application/javascript"
Daroute.addMineType("file.custom", "application/javascript")
```