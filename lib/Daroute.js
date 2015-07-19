/*
* Christophe Matthieu
*/


var fs = require('fs'),
    util = require('util'),
    qs = require('querystring');


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
Daroute.addException("AccessDenied", 401, 'warn');
Daroute.addException("NotFound", 404, 'warn');


/**
 * onException method.
 * 
 * @api public
 */


var ExceptionCallback = {};
Daroute.onException = function onException (name, callback) {
  if (!Daroute.Exception[name]) {
    Daroute.logger.error("You try to bind an exception event, but '%s' doesn't exist.", name);
    return;
  }
  if (typeof callback != "function") {
    Daroute.logger.error("You try to bind an onException event, but callback of '%s' is not a function.", name);
    return;
  }
  Daroute.logger.info("Bind a callback '%s' on '%s'", callback.name, name);
  ExceptionCallback[name] = callback;
};


/**
 * onBegin method.
 * The callbacks is called just before the callback of the routes, when a route is found
 *
 * Eg.: connect to DB
 *
 * @api public
 */


var BeginCallback = [];
Daroute.onBegin = function onBegin (callback) {
  if (typeof callback != "function") {
    Daroute.logger.error("You try to bind an onBegin event, but callback is not a function.");
    return;
  }
  Daroute.logger.info("Bind a callback '%s' called just before the callback of the routes", callback.name);
  BeginCallback.push(callback);
};


/**
 * onEnd method.
 * The callbacks is called if a callback of no static route don't throw any error
 *
 * Eg.: DB commit
 *
 * @api public
 */


var EndCallback = [];
Daroute.onEnd = function onEnd (callback) {
  if (typeof callback != "function") {
    Daroute.logger.error("You try to bind an onEnd event, but callback is not a function.");
    return;
  }
  Daroute.logger.info("Bind a callback '%s' called if a callback of no static route don't throw any error", callback.name);
  EndCallback.push(callback);
};


/**
 * onError method.
 * The callbacks is called if a callback of no static route thow an error
 *
 * Eg.: DB roolback
 *
 * @api public
 */


var ErrorCallback = [];
Daroute.onError = function onError (callback) {
  if (typeof callback != "function") {
    Daroute.logger.error("You try to bind an onEnd event, but callback is not a function.");
    return;
  }
  Daroute.logger.info("Bind a callback '%s' called if a callback of no static route thow an error", callback.name);
  ErrorCallback.push(callback);
};


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
    var bnb = 0;
    var anb = 0;
    b.types.forEach(function (value) {if (value) bnb++;});
    a.types.forEach(function (value) {if (value) anb++;});
    return (bnb + b.args.length + b.name.split("/").length) - (anb + a.args.length + a.name.split("/").length);
};


/**
 * add method.
 *
 * Variable parts of the route are content between < and > (Eg. <toto> )
 * You can specify the type of variable part. (Eg. <int:toto> )
 * Diffrents types available: int, float, hexa, alnum, path, list_int
 * Retour static files if callback is false
 * options:
 * - cache: boolean, string or function(request) who return the hash to get the cache;
 *     if true the cache is register to request.url (all caches are depend of the encoding)
 * - encoding: boolean: get accept-encoding header attributes to gzip or deflate the
 *     data before send to the client (if cache: encoding buffer is use buy the cache)
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


var routes = [];
var pathRegExp = {};
Daroute.add = function add (/* route, route, ... callback, options */) {
    var list_routes = Array.prototype.slice.call(arguments, 0),
        callback = list_routes.pop(),
        options = {};

    if (typeof callback == "object") {
        options = callback;
        callback = list_routes.pop();
    }

    if (typeof callback == "string" && callback.indexOf("/") !== 0) {
        Daroute.logger.error("The path of the static route '%s' not begin by '/'.", list_routes[0]);
    }
    if (typeof callback != "function" && typeof callback != "string") {
        Daroute.logger.error("The callback of the route '%s' is not a method or a path (for static files).", list_routes[0]);
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
            name: route,
            encoding: options.encoding || null,
            cache: options.cache || null
        });

        if (typeof callback == "function") {

          Daroute.logger.info("Create route '%s' with callback '%s'", route, callback.name);

        } else {
          
          Daroute.logger.info("Create route '%s' for static files in '%s'", route, callback);

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
    routes.sort(Daroute.sort);
};


/**
 * addPathExpression method.
 * If the parser callback return an undefined, the route is aboarded (the parser is optionnal).
 * Note: onBegin callbacks have not yet been called.
 * 
 * Eg.
 * Daroute.addPathRegExp('IPv4', '[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}', function (val) {
 *   val = val.split(".");
 *   for (var k in val) {
 *     val[k] = parseInt(val[k]);
 *   }
 *   return val;
 * });
 *
 * @api public
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
 * Cookie object
 *
 * @api public
 */

Daroute.Cookie = function Cookie(request, response) {
  if (request.headers.cookie) {
    var vars = request.headers.cookie.split("; ");
    for (var i=0; i<vars.length; i++) {
      var val = vars[i].split("=");
      var key = qs.unescape(val[0]);
      var value = qs.unescape(val[1]);
      try { value = JSON.parse(value); } catch (e) {}
      if (typeof this[key] === "undefined") {
        this[key] = value;
      } else if (this[key] instanceof Array) {
        this[key].push(value);
      } else {
        this[key] = [this[key], value];
      }
    }
  }
  Object.defineProperty(this, "__COOKIES__", { enumerable: false, value: [] });
};
Daroute.Cookie.prototype.get = function (key) {
  return this[key];
};
Daroute.Cookie.prototype.set = function (key, value, options) {
  if (["get", "set", "clear", "__COOKIES__"].indexOf(key) !== -1) {
    throw new Daroute.Exception.ValueError("'%s' is a reserved keyword", key);
  }

  options = options || {};
  var cookie = key + "=" + value;

  if (options.expires) {
    cookie += "; expires="+ new Date(options.expires).toGMTString();
  } else if (options.lifetime) {
    cookie += "; expires="+ new Date(new Date().getTime()+options.lifetime*1000).toGMTString();
  } else if(typeof options.expires !== "undefined") {
    cookie += "Sun, 25 May 2064 11:30:55 GMT";
  }
  if (options.path) {
    cookie += "; path="+options.path;
  }
  if (cookie.domain) {
    cookie += "; domain="+options.domain;
  }

  this.__COOKIES__.push(cookie);
};
Daroute.Cookie.prototype.clear = function (key, options) {
  options = options || {};
  options.lifetime = -1000;
  this.set(key, null, options);
};

/**
 * Session object
 * The session_id cookie is create when a key is added to request.params.session
 *
 * @api public
 */

Daroute.sessions = {};

var timeout;
(function cleanup() {
  var session, time = new Date().getTime();
  for (var k in Daroute.sessions) {
    if (!Daroute.sessions.hasOwnProperty(k)) continue;
    if (Daroute.sessions[k].expires > time) continue;
    delete Daroute.sessions[k];
  }
  timeout = setTimeout(cleanup,60000);
})();

Daroute.generateSessionID = function generateSessionID(){
  var id = [];
  for (var i=0; i<8; i++) {
    id.push((Math.random()*0x1000000000).toString(36));
  }
  id.push(new Date().getTime().toString(36));
  return id.join("-");
};
Daroute.session = function session(request, response) {
  var SID = request.params.cookie.get("DarouteSessionID");
  var session;

  if (SID) {
    if (!Daroute.sessions[SID]) {
      request.params.cookie.clear("DarouteSessionID");
      SID = false;
    } else {
      session = Daroute.sessions[SID];
      delete session.expires;
    }
  }

  if (!SID) {
    session = { lifetime: 86400 };
  }

  request.params.session = session;
};
Daroute.sessionCookie = function sessionCookie(request, response) {
  var session = request.params.session;

  if (!session) {
    return request.params.cookie.clear("DarouteSessionID");
  }
  
  var keys = Object.keys(session).length;
  if (session.lifetime) keys--;
  if (session.expires) keys--;
  if (session.path) keys--;
  if (session.domain) keys--;
  if (!keys) {
    delete Daroute.sessions[session.session_id];
    return null;
  }
  
  if (!session.session_id) {
    SID = Daroute.generateSessionID();
    Object.defineProperty(session, "session_id", { enumerable: false, writeable: false, value: SID });
    Daroute.sessions[SID] = session;
  }

  return request.params.cookie.set("DarouteSessionID", session.session_id, session);
};

/**
 */

var zlib = require('zlib');
Daroute.cache = {};
Daroute.clearCache = function (hash) {
  if (!hash) {

    Daroute.cache = {};

  } else if (typeof hash === 'string') {

    delete Daroute.cache[hash];

  } else {

    for (var i in Daroute.cache) {
      if (hash.test(i)) {
        delete Daroute.cache[i];
      }
    }

  }
};
Daroute.setCache = function (hash, encoding, data, type) {
  if (!Daroute.cache[hash]) {
    Daroute.cache[hash] = {};
  }
  Daroute.cache[hash][encoding] = {
    'data': data,
    'type': type
  };
};
Daroute.getCache = function (hash, encoding) {
  var cache = Daroute.cache[hash];
  return cache && cache[encoding];
};


/**
 * handlerRoute method.
 * Handler for http.createServer
 * Handle throws et log the errors
 * Check all route and return the first match
 * The route are sorted by complexity
 * If a no static route is found:
 * - trigger onBegin
 * - if no error: trigger onEnd
 * - else: trigger onError
 *
 * Arguments is add to request
 *   request.params.route: with all arguments from the route
 *   request.params.get : with all arguments from the querystring
 *   request.params.post : with all arguments from the post form
 * If you want to post files, use enctype='multipart/form-data' for your HTML form
 *
 * @api public
 */

Daroute.handler = function handler (request, response) {

  var url = request.url.split("?"),
      path = url[0],
      callback = false,
      route_name = false,
      useEncoding = false,
      useCache = false;

  request.params = { };

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
      route_name = routes[k].name;
      useEncoding = routes[k].encoding;
      useCache = routes[k].cache;
      if (typeof routes[k].callback == "function") {
        callback = routes[k].callback;
      } else {
        request.folderStaticFile = routes[k].callback;
        callback = Daroute.staticFile;
      }
      break;
    }
  }

  // ENCODING
  var encoding = false;
  if (useEncoding) {
    var acceptEncoding = request.headers['accept-encoding'] || "";
    if (acceptEncoding.indexOf("deflate") !== -1) {
      encoding = 'deflate';
    } else if (acceptEncoding.indexOf("gzip") !== -1) {
      encoding = 'gzip';
    }

    var encoding_fn = function encoding_fn (data, callback) {
      if (encoding === "gzip") {
        zlib.gzip(data, callback);
      } else if (encoding === "deflate") {
        zlib.deflate(data, callback);
      } else {
        callback(null, data);
      }
    };
  }

  // CACHE
  var cache_id;
  if(useCache) {
    if (useCache === true) cache_id = request.url;
    else if(typeof useCache === 'string') cache_id = useCache;
    else cache_id = useCache(request);
  }

  // CACHE & ENCODING => rebind end method
  if (cache_id || encoding) {
    var __end = response.end;
    response.end = function (data, encode) {
      var type = response._header.match(/content-type: (\S+)/i);
      type = type && type[1];
      
      function ender (err, buffer) {
        if(cache_id) {
          Daroute.setCache(cache_id, encoding, buffer, type);
        }
        __end.call(response, buffer, encode);
      }

      if (encoding === "deflate") {
        zlib.deflate(data, ender);
      } else if (encoding === "gzip") {
        zlib.gzip(data, ender);
      } else {
        ender(null, data);
      }
    };
  }

  // COOKIE & SESSION & ENCODING => rebind writeHead method
  if (callback) {
    request.params.cookie = new Daroute.Cookie(request, response);
    Daroute.session(request, response);

    var writeHead = response.writeHead;
    response.writeHead = function (statusCode) {
      var reasonPhrase = arguments.length === 3 ? arguments[1] : null;
      var _headers = arguments[arguments.length-1];
      var headers = [];
      var cookie;

      // set cookie DarouteSessionID for session
      Daroute.sessionCookie(request, response);

      // save cookie
      var cookies = request.params.cookie.__COOKIES__;
      for (var k=0; k<cookies.length; k++) {
        headers.push(['Set-Cookie', cookies[k]]);
      }

      // encoding: gzip/deflate
      if (encoding) {
        headers.push(['Content-Encoding', encoding]);
      }

      // headers from routes
      var res_headers = response._headers;
      for (var k in res_headers) {
        headers.push([k, res_headers[k]]);
      }

      // headers from writeHead method
      if (_headers instanceof Array) {
        headers = headers.concat(_headers);
      } else {
        for (var k in _headers) {
          headers.push([k, _headers[k]]);
        }
      }

      if (reasonPhrase) {
        writeHead.call(response, statusCode, reasonPhrase, headers);
      } else {
        writeHead.call(response, statusCode, headers);
      }
    };
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
        Daroute.logger.debug("Get route '%s' with arguments:", route_name, request.params);
      } else {
        throw new Daroute.Exception.NotFound(request.url);
      }

      //on onBegin
      if (callback != Daroute.staticFile) {
        try {
          for (var k in BeginCallback) {
            BeginCallback[k](request, response);
          }
        } catch (er) {
          handlerError(request, response, er);
          return;
        }
      }


      // Activate Route or load from cache
      var cache;
      if (cache_id && (cache = Daroute.getCache(cache_id, encoding))) {
        Daroute.logger.debug("Load from the cache (don't load route method)");
        response.writeHead(200, {'content-type': cache.type });
        __end.call(response, cache.data);
      } else {
        // Activate Route
        callback(request, response);
      }

      //on success
      if (callback != Daroute.staticFile) {
        try {
          for (var k in EndCallback) {
            EndCallback[k](request, response);
          }
        } catch (er) {
          handlerError(request, response, er);
          return;
        }
      }

    } catch (er) {
      handlerError(request, response, er);
      //on unsuccess
      if (callback && callback != Daroute.staticFile) {
        try {
          for (var k in ErrorCallback) {
            ErrorCallback[k](request, response);
          }
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


var mineTypes = {};
Daroute.staticFile = function staticFile (request, response) {
    var url = request.url;

    return fs.readFile(request.folderStaticFile + url, function (err, buffer) {
      if (err) {
        handlerError(request, response, new Daroute.Exception.NotFound("Static File: " + url));
        return;
      }

      response.writeHead(200, {'content-type': Daroute.getMineType(url) || 'text/plain'});
      response.end(buffer);

      Daroute.logger.debug("Static file: %s", url);
    });
};


/**
 * getMineType method
 *
 * @api public
 */


Daroute.getMineType = function getMineType (fileName) {
    var ext = fileName.split(".").pop().toLowerCase();
    return mineTypes[ext] || false;
};



/**
 * addMineType method
 * Add a mineType function of file extention
 * @ext: STRING extention or Array of [ext, mt]
 * @mt: STRING mineType
 *
 * @api public
 */


Daroute.addMineType = function addMineType (extention, mineType) {
  if (typeof extention !== 'string') {
      extention.forEach(function (mt) { mineType.add(mt[0], mt[1]); });
      return;
  }
  extention.split(" ").forEach(function (ext) {
      if (ext !== "")
        mineTypes[ext.toLowerCase()] = mineType;
  });
};

/* add a list of mineTypes */
fs.readFile(__dirname + "/mineType.data", function (err, buffer) {
  if (err) {
    Daroute.logger.warn("No mineType.data found");
    return;
  }
  buffer.toString("utf8").split("\n").forEach(function (line) {
    line = line.split(/[ ]+/);
    var mineType = line.shift();
    if (line.indexOf("#") === 0 || mineType === "") {
      return;
    }
    Daroute.addMineType(line.join(" "), mineType);
  });
});


/**
 * Export module
 *
 * @api public
 */


module.exports = Daroute;
