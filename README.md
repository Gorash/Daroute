Daroute.js
==========

## Introduction

Daroute is a node.js routing framework and path analizer module.

* define simple or dynamic routes (with or without parser)
* find the best route who match, if no route found throw a NotFound error
* mineType used to serve static files
* define custom errors
* handle error
* complete and colored console log
* ...

Here is an example on how to use it:

```js
var Daroute = require('Daroute');
require('http').createServer(Daroute.handler).listen(8080);

// try with http://127.0.0.1:8080/toto
Daroute.add('/toto', function (request, response) {
  response.end("your html content");
});
```
Example for static files:

```js
// http://127.0.0.1:8080/static/sound/test.mp3 serve the file /v1_alpha/static/sound/test.mp3
Daroute.add('/static/<path:path>.(png|mp3|ogg|wav|css|js)', __dirname + '/v1_alpha/');
```

Example for dynamic urls:

```js
// try with /forum/name-of-the-question-1/5,78?order=desc
Daroute.add('/forum/<record(forum.question):forum>/<list_int:range>', function (request, response) {
  console.log(request.params.get);
  // {order: 'desc'}
  console.log(request.params.route);
  // {forum: [Object forum.question:1], range: [5,78]}
  response.end("your html content");
});
```

## add routes

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
   response.end("Hello Word !"); 
});
// try with http://127.0.0.1:8080/my/route/55/--*98fs+%20--/truc5,6,8,78
// request.params contain { get: {}, route: {lou: 55, bobo: '--*98fs+%20--', pepe: [5,6,8,78]}, post: {} }
```

### route options: encoding, cache, headers...

You can define for all routes (static or not) some options like:
* encoding: automatically encode the result (static file or method result) in function of the client browser ('deflate' or 'gzip').
* cache: cache the route result server side (useful for performance especially for minifications or encoding)
* headers: set default headers (you can overwrite it in the function of the no static routes)
* ...

```js
// define a static route link to an other alpha folder
// http://127.0.0.1:8080/static/sound/test.mp3 serve the file /v1_alpha/static/sound/test.mp3
Daroute.add('/static/<path:path>.(png|mp3|ogg|wav|css|js)', __dirname + '/v1_alpha/', {
  'encoding': true,
  'cache': true,
  'headers': {'Cache-Control': 'max-age=2592000, cache, store'}
});
```

### route are sorted by complexity

```js
Daroute.add('/my/route/<lou>', function lou1 (request, response) { 
   response.end("Hello Word !"); 
});
Daroute.add('/my/route/<int:lou>', function lou2 (request, response) { 
   response.end("Hello Word !"); 
});
// try with http://127.0.0.1:8080/my/route/55
// lou2 is called and request.params.route.lou is an integer with a value = 55
```

### defined your specific parser for your custom types

The parsers receive all the regex match as first value and can receive an optional second argument from the data surrounded by parentheses in the route

```js
// add a new path parser for the routes
// value: path who match with the regexp (semantic URL to improve SEO for eg.)
// model: data surrounded by parentheses in the route
Daroute.addPathRegExp('record', '[^/]+-[0-9]*', function record_parser (value, model) {
  var id = parseInt( value.split("-")[1] );
  // eg. select in DB
  // ... if the user haven't access: throw new Daroute.Exception.AccessDenied("You can't access to %s[%s]", model, id);
  // ...
  return record;
});

// define route with custom exeption
Daroute.add('/<record(user):bobo>/<record(user):user>', function user_route (request, response) {
  response.writeHead(202);
  response.end("user id = " + request.params.route.bobo);
});
// try with http://127.0.0.1:8080/name-user-65/other-name-45?user=77
// request.params contain: { get: {user: '77'}, route: { bobo: [DB object 65], user: [DB object 45] }, post: {} }
```

## onRequest, onBegin, onEnd, onError, onFinish

Daroute call all your onBegin method before call a route method
Daroute call all your onEnd method if they are no error in the route method
Daroute call all your onError method if they are a least one error catched in the route method

```js
Daroute.onRequest(function DB_open () {
  // eg. open your DB and begin a transaction (if you don't use the database in parser, better to connect into onBegin)
});
Daroute.onBegin(function DB_open () {
  // eg. set/get few datas in DB
});
Daroute.onEnd(function DB_commited () {
  // eg. commit your data's transaction into your DB
});
Daroute.onError(function DB_roolback () {
  // eg. roolback your transaction
});
Daroute.onFinish(function DB_roolback () {
  // eg. close DB connexion
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
