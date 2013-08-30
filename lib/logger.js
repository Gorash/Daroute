/*
* Christophe Matthieu
*/


/**
 * Log levels.
 */

var levels = [
    'error'
  , 'warn'
  , 'info'
  , 'debug'
];

/**
 * Colors for log levels.
 */

var colors = [
    'red'
  , 'yellow'
  , 'green'
  , 'blue'
  // others colors
  , 'black', 'white', 'cyan', 'magenta'
];

/**
 * Logger (console).
 *
 * @api public
 */

var Logger = module.exports = function Logger (name, opts) {
  if (typeof name == 'string') {
    this.name = name;
  }
  else {
    opts = name;
  }
  opts = opts || {}
  this.level = !isNaN(+opts.level) ? opts.level : 3;
};

/**
 * Log method.
 *
 * @api public
 */


Logger.prototype.log = function log (type) {
  var index = levels.indexOf(type);

  if (index > this.level)
    return this;

  var args = Array.prototype.slice.call(arguments, 1);
  var title = this.font(type.toUpperCase(), {bold: true, color: colors[index]});
  if (this.name) {
    var date = new Date().toISOString().replace(/T/, ' ').replace(/\..*/, '');
    title = date + ' ' + this.font(this.name, {bold: true, color: 'blue'}) + ' - ' + title;
  }
  if (typeof args[0] == 'string') {
    args[0] = title + ' - ' + (args[0] || "");
  } else {
    args.unshift(title);
  }

  console.log.apply(console, args);

  return this;
};

/**
 * Generate methods.
 */

levels.forEach(function (name) {
  Logger.prototype[name] = function () {
    this.log.apply(this, [name].concat(Array.prototype.slice.call(arguments, 0)));
  };
});


/**
 * Color font
 */

Logger.prototype.font = function font (text, options) {

  var COLOR = {
    black : 0,
    red : 1,
    green : 2,
    yellow : 3,
    blue : 4,
    magenta : 5,
    cyan : 6,
    white : 7
  };

  if (options.bold) {
    text = "\033[1m" + text;
  }

  if (typeof options.color == "string") {
    text = "\033[" + ( COLOR[options.color] + 30 ) + "m" + text;
  } else if (typeof options.color == "number") {
    text = "\033[" + ( options.color + 30 ) + "m" + text;
  }

  if (typeof options.bgcolor == "string") {
    //The background is set with 40 plus the number of the color
    text = "\033[" + ( COLOR[options.bgcolor] + 40 ) + "m" + text;
  } else if (typeof options.bgcolor == "number") {
    //The background is set with 40 plus the number of the color
    text = "\033[" + ( COLOR[options.bgcolor] + 40 ) + "m" + text;
  }

  // reset font
  if (!options.no_reset) {
    text += "\033[0m";
  }

  return text;
}
