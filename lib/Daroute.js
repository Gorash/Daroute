/*
* Christophe Matthieu
*/


var fs = require('fs'),
    util = require('util'),
    qs = require('querystring');


/**
 * Private values
 *
 */


var routes = [];
var ExceptionCallback = {};
var pathRegExp = {};


/**
 * Daroute
 *
 * @api public
 */


var Daroute = new (function Daroute () {})();


/**
 * Logger Constructor
 *
 * @api public
 */


Daroute.builderLogger = require('./logger');


/**
 * Logger instance for Daroute
 *
 * @api public
 */


Daroute.logger = new Daroute.builderLogger('Daroute', {level: 2}),


/**
 * addException method.
 * Create custom Exceptions
 * All of this exceptions are catched by handlerCatcher method
 *
 * @values:
 * type (INT)
 *   - error type number (eg. Not found is error 404)
 * logged (null, 'error', 'warn', 'info', 'debug')
 *   - You can give more of one arguments when you use an error.
 *   - Arguments are converted with util.format and logged with console.log
 *   - If logged, stack is automatically add after with Daroute.logger.debug
 *
 * Eg. to use:
 * throw new Daroute.Exception.ValueError("'%s' is not a string", value);
 *
 *
 * @api public
 */


Daroute.Exception = {};
Daroute.addException = function addException (name, type, logged) {

  Daroute.Exception[name] = function CustomException () {
    Error.call(this);

    this.stack = name + ":\n" + new Error().stack.split("\n").splice(2).join("\n");
    this.CustomError = true;
    this.title = name;
    this.type = isNaN(+type) ? 500 : +type;
    this.logged = logged || false;
    this.message = util.format.apply(false, arguments);

    if (this == Daroute.Exception) {
      Daroute.logger.warn("Please use new to declare: '\033[33m%s\033[0m: %s'", this.title, this.message);
      return this;
    }
  };
  Daroute.Exception[name].prototype = Error.prototype;

};

Daroute.addException("BadRequest", 400, 'error');
Daroute.addException("ValueError", 500, 'error');
Daroute.addException("TypeError", 500, 'error');
Daroute.addException("AccessError", 406, 'error');
Daroute.addException("AccessDenied", 401, 'error');
Daroute.addException("NotFound", 404, 'warn');


/**
 * onException method.
 * 
 *
 * @api public
 */


Daroute.onException = function onException (name, callback) {
  if (!Daroute.Exception[name]) {
    Daroute.logger.error("You try to bind an exception event, but '%s' doesn't exist.", name);
    return;
  }
  if (typeof callback != "function") {
    Daroute.logger.error("You try to bind an onException event, but callback of '%s' is not a function.", name);
    return;
  }
  Daroute.logger.info("Bind a callback on %s", name);
  ExceptionCallback[name] = callback;
};


/**
 * onBegin method.
 * This function is called before the route (if the route is found)
 *
 * @api public
 */


Daroute.onBegin = function SuccessCallback () {};


/**
 * onSuccess method.
 * This function is called after the route if they are no error
 *
 * @api public
 */


Daroute.onSuccess = function SuccessCallback () {};


/**
 * onUnsuccess method.
 * This function is called after the route if they are one error
 *
 * @api public
 */


Daroute.onUnsuccess = function UnsuccessCallback () {};


/**
 * Sort method.
 *
 * The routes are sorted by complexity: (nb of types + nb of args + number of "/")
 *
 *
 * Eg. result of sorting
 * /my/route/<int:lou>/<bobo>/truc<list_int:pepe>
 * /my/route/<lou>/<bobo>/truc<list_int:pepe>
 * /my/route/<lou>/<bobo>/
 * /my/route/
 *
 * @api public
 */


Daroute.sort = function sort (a, b) {
    return (b.types + b.args + b.name.split("/").length) - (a.types + a.args + a.name.split("/").length);
};


/**
 * add method.
 *
 * Variable parts of the route are content between < and > (Eg. <toto> )
 * You can specify the type of variable part. (Eg. <int:toto> )
 * Diffrents types available: int, float, hexa, alnum, path, list_int
 * Retour static files if callback is false
 *
 * The routes are sorted with complexity by Daroute.sort
 *
 * Arguments is on request.params
 *   request.params.route: Arguments from the route
 *   request.params.get :  Arguments from the querystring
 *   request.params.post : Arguments from the post form
 * If you want to post files, use enctype='multipart/form-data' for your HTML form
 *
 *
 * Eg.
 * Daroute.add('/my/route/<int:lou>/<bobo>/truc<list_int:pepe>', function (request, response) { 
 *   response.writeHead(200);
 *   response.end("Hello Word !"); 
 * })
 *
 * if path: /my/route/55/--*98fs+%20--/truc5,6,8,78
 * then request.route = {lou: 55, bobo: '--*98fs+%20--', pepe: [5,6,8,78]}
 *
 *
 * @api public
 */


Daroute.add = function add (/* route, route, ... callback */) {
    var list_routes = Array.prototype.slice.call(arguments, 0),
        callback = list_routes.pop();

    if (typeof callback != "function" && callback !== false) {
        Daroute.logger.error("The callback of the route '%s' is not a method or false (for static files).", list_routes[0]);
    }

    list_routes.forEach( function (route) {
        if (route.indexOf("/") !== 0) {
            Daroute.logger.error("Route '%s' not begin by '/'", route);
        }

        var args = [],
            types = [],
            parsers = [],
            regexp = new RegExp('^' +
                route
                    .replace(/<(([^>]+):)?([^>]+)>/g, function (a, b, type, arg) {
                        args.push(arg);
                        types.push(type || false);
                        parsers.push(type ? pathRegExp[type][1] : false);
                        return "(" + (type && pathRegExp[type] ? pathRegExp[type][0] : '.*') + ")";
                    }) +
                '$');

        routes.push({
            callback: callback,
            regexp: regexp,
            args: args,
            types: types,
            parsers: parsers,
            name: route
        });

        if (callback) {

          Daroute.logger.info("Create route '%s' with callback '%s'", route, callback.name);

        } else {
          
          Daroute.logger.info("Create route for static files '%s'", route);

        }
    });

    /**
     * sort routes
     */
    function count (list) {
      var c = 0;
      list.forEach(function (value) {
        if (value) c++;
      });
      return c;
    }
    routes.sort(function (a, b) {
      return Daroute.sort(
        {types: count(b.types), args: b.args.length, name: b.name},
        {types: count(a.types), args: a.args.length, name: a.name});
    });
};


/**
 * addPathExpression method.
 * If the parser return an undefined, the route is aboarded
 *
 * @api private
 */


Daroute.addPathRegExp = function addPathExpression (name, regexp, parser) {
  if (pathRegExp[name]) {
    Daroute.logger.error("Path RegExp '%s' already exists.", name);
    return;
  }
  try {
    new RegExp(regexp).test("test");
  } catch (e) {
    Daroute.logger.error("Path RegExp '%s' have a wrong RegExp value '%s'. (%s)", name, regexp, e);
    return;
  }
  pathRegExp[name] = [regexp, parser || false];
};
Daroute.addPathRegExp('int', '[0-9]+', parseInt);
Daroute.addPathRegExp('float', '[0-9]+[.]?[0-9]*', parseFloat);
Daroute.addPathRegExp('alnum', '[a-zA-Z0-9]+');
Daroute.addPathRegExp('hexa', '[0-9A-F]+');
Daroute.addPathRegExp('path', '.*');
Daroute.addPathRegExp('list_int', '[0-9]+([,][0-9]+)*', function (val) {
    val = val.split(",");
    for (var k in val) {
      val[k] = parseInt(val[k]);
    }
    return val;
  });


/**
 * compare method.
 * Compare if the path match with a route and return args (key=>value)
 *
 * @api private
 */


var compare = function compare ( route, path ) {
    var found = route.regexp.exec(path);

    if (!found) {
        return false;
    }

    found.shift();

    var res = {};
    for (var k in route.args) {
      var val = decodeURI(found[k]);
      if (route.parsers[k]) {
          val = route.parsers[k](val);
          if (val === undefined) {
            return false;
          }
      }
      res[decodeURI(route.args[k])] = val;
    }
    return res;
};


/**
 * handler Error method.
 *
 * @api private
 */


var handlerError = function handlerError (request, response, er) {

  if (typeof er != "object") {
    er = {message: er};
  }

  er.title = er.title || "Unknown Error";
  request.error = er;

  if (er.CustomError) {
    if (er.logged) {

      Daroute.logger[er.logged]("\033[33m%s\033[0m: %s", er.title, er.message);
      Daroute.logger.debug(er.stack);

    }
    
    if (ExceptionCallback[er.title]) {

      //on exception for specific custom errors
      ExceptionCallback[er.title](request, response);

    } else {

      response.writeHead(er.type);
      response.end(er.title + ': ' + er.message);

    }
  } else {

    Daroute.logger.error("\033[33m%s\033[0m: %s\n%s\n", er.title, er.message, er.stack);
    response.writeHead(500);
    response.end('Unknown Error: ' + er.message);

  }
};


/**
 * handlerRoute method.
 * Handler for http.createServer
 * Handle throws et log the errors
 * Check all route and return the first match
 * The route are sorted by complexity
 * If a no static route is found:
 * - trigger onBegin
 * - if no error: trigger onSuccess
 * - else: trigger onUnsuccess
 *
 * Arguments is add to request
 *   request.params.route: with all arguments from the route
 *   request.params.get : with all arguments from the querystring
 *   request.params.post : with all arguments from the post form
 * If you want to post files, use enctype='multipart/form-data' for your HTML form
 *
 *
 * @api public
 */


Daroute.handler = function handler (request, response) {

  var url = request.url.split("?"),
      path = url[0],
      callback = false;
  
  request.params = {};

  // GET
  request.params.get = url[1] ? qs.parse(url[1]) : {};
  
  // Find route
  for(var k in routes) {
    try {
      request.params.route = compare(routes[k], path);
    } catch (er) {
      handlerError(request, response, er);
      continue;
    }
    if (request.params.route) {
      if (routes[k].callback) {
        callback = routes[k].callback;
      } else {
        callback = Daroute.staticFile;
      }
      break;
    }
  }

  // POST
  var buffer_concat = new Buffer(0);
  request.on('data', function (buffer) {
    buffer_concat = Buffer.concat([buffer_concat, buffer]);
  });

  // Use end event to receive all data form post
  request.on('end', function () {
    try {
      // POST
      request.params.post = {};
      var ct = request.headers['content-type'];
      if (ct && ct.indexOf("multipart/form-data") > -1) {
        var type = ct.split(";")[0],
            boundary = "--" + ct.split('; ')[1].split('=')[1],
            reg = /name="((\\\\)*\\"|([^"]|[^\\](\\\\)*\\")*)"(; filename="(((\\\\)*\\"|([^"]|[^\\](\\\\)*\\")*)*)")?/i,
            ids = [],
            i = 0,
            bound = false;

        while (i < buffer_concat.length) {
          if (buffer_concat.slice(i, i+boundary.length).toString() == boundary) {
            ids.push(i ? i-2 : 0);
            i += boundary.length + 2;
            ids.push(i);
            bound = true;
          } else if (bound && buffer_concat.slice(i, i+4).toString() == '\r\n\r\n') {
            ids.push(i);
            i += 4;
            ids.push(i);
            bound = false;
          }
          i++;
        }
        ids.push(buffer_concat.length);

        var datas = {},
            nreg = false;
        for (i=0; i < ids.length-4; i+=4) {
            var header = buffer_concat.slice(ids[i+1], ids[i+2]).toString();
            if (header.length) {
              var hcd = header.split("\r\n")[0].match(reg);
              var hct = header.split("\r\n")[1];
              var data = buffer_concat.slice(ids[i+3], ids[i+4]);
              if (!hct || hcd[6]) {
                datas[hcd[1]] = !hct ?
                  data.toString("utf8") :
                  { filename: hcd[6],
                    buffer: new Buffer(data),
                    mineType: hct.split(': ')[1] };
              }
            }
        }
        request.params.post = datas;
      } else {
        request.params.post = qs.parse(buffer_concat.toString());
      }

      if (callback) {
        Daroute.logger.debug("Get route '%s' with arguments:", routes[k].name, request.params);
      }

      //on onBegin
      if (callback && callback != Daroute.staticFile) {
          Daroute.onBegin(request, response);
      }

      // Activate Route
      if (callback) {
        callback(request, response);
      } else {
        throw new Daroute.Exception.NotFound(request.url);
      }

      //on success
      if (callback && callback != Daroute.staticFile) {
          Daroute.onSuccess(request, response);
      }
    } catch (er) {
      handlerError(request, response, er);
      //on unsuccess
      if (callback && callback != Daroute.staticFile) {
        try {
          Daroute.onUnsuccess(request, response);
        }  catch (er) {
          handlerError(request, response, er);
          return;
        }
      }
      return;
    }

  });
};


/**
 * Serve static files
 *
 * @api private
 */


Daroute.staticFile = function staticFile (request, response) {
    var url = request.url;

    return fs.readFile(__dirname + url, function (err, buffer) {
      if (err) {
        handlerError(request, response, new Daroute.Exception.NotFound("Static File: " + url));
        return;
      }

      var ext = url.split(".").pop();
      if ('js' == ext)
        response.setHeader('content-type', "application/javascript");
      else if ('css' == ext)
        response.setHeader('content-type', "text/css");
      else if ('png jpg jpeg gif'.indexOf(ext) > -1)
        response.setHeader('content-type', "image/" + ext);
      else if ('zip rar exe tar gz pdf'.indexOf(ext) > -1)
        response.setHeader('content-type', "application/octet-stream");
      else
        response.setHeader('content-type', 'text/plain');

      response.writeHead(200);
      response.end(buffer);

      Daroute.logger.debug("Static file: %s", url);
    });
};


/**
 * Export module
 *
 * @api public
 */


module.exports = Daroute;