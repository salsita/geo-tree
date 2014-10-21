!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.GeoTree=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// geo-tree implementation (using red-black tree and z-curve)
//
// public API of GeoTree:
// ---
// var gt = new GeoTree();  ... create empty tree
// gt.insert(...);          ... inserts (array of) { lat: ..., lng: ..., data: ...} object(s)
// gt.find(...);            ... returns array of data objects with specified coordinates /
//                              in specified rectangle / in specified circle
// gt.forEach(cb);          ... invokes cb callback on each inserted data object in the tree
// ---
// gt.dump();               ... text dump of the tree (for debugging / testing // purposes)

var RBTree = _dereq_('./red-black');
var curve = _dereq_('./z-curve');

// --- helper functions ---

function getValidationFn(center, dist, units) {

  function toDeg(rad) { return rad * 180.0 / Math.PI; }
  function toRad(deg) { return deg * Math.PI / 180.0; }

  // mean Earth radius (http://en.wikipedia.org/wiki/Earth_radius#Mean_radius)
  var R = 6371009.0;  // in meters
  // meter to X
  var conversionTable = [
    { units: 'm', ratio: 1.0 },
    { units: 'km', ratio: 1000.0 },
    { units: 'yd', ratio: 0.9144 },
    { units: 'mi', ratio: 1609.34 }
  ];

  for (var i = 0; i < conversionTable.length; i++) {
    if (conversionTable[i].units === units) { break; }
  }

  // in angle degrees already
  if (conversionTable.length === i) {
    var radius2 = dist * dist;
    return {
      angle: dist,
      validate: function(coord) {
        var dlat = center.lat - coord.lat;
        var dlng = center.lng - coord.lng;
        return (dlat * dlat + dlng * dlng <= radius2);
      }
    };
  }

  // distance-based
  var adjustedDist = dist * conversionTable[i].ratio;  // in meters
  return {
    angle: toDeg(adjustedDist / (R * Math.cos(toRad(center.lat)))),
    validate: function(coord) {
      // Haversine algo (http://mathforum.org/library/drmath/view/51879.html)
      var dlat = toRad(center.lat - coord.lat);
      var dlng = toRad(center.lng - coord.lng);
      var sin_dlat_2 = Math.sin(dlat/2);
      var sin_dlng_2 = Math.sin(dlng/2);
      var cos_ce_lat = Math.cos(toRad(center.lat));
      var cos_co_lat = Math.cos(toRad(coord.lat));
      var a = sin_dlat_2 * sin_dlat_2 + cos_ce_lat * cos_co_lat * sin_dlng_2 * sin_dlng_2;
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return (R * c <= adjustedDist);
    }
  };
}

// --- end of helper functions ---

function GeoTree() {
  this.tree = new RBTree();
}

// supported args:
// { lat: ..., lng: ..., data: ... }  - single object
// [ { lat: ..., lng: ..., data: ... }, ... ]  - array of the above objects
// lat, lng, data  - 3 args
GeoTree.prototype.insert = function(arg1, arg2, arg3) {
  var lat, lng, data;
  if ('number' === typeof(arg1)) {
    lat = arg1;
    lng = arg2;
    data = arg3;
  } else if ('object' === typeof(arg1)) {
    if ('number' === typeof(arg1.length)) {
      for (var i = 0; i < arg1.length; i++) { this.insert(arg1[i]); }
      return;
    } else {
      lat = arg1.lat;
      lng = arg1.lng;
      data = arg1.data;
    }
  } else { return; } // unsupported args
  // lat: -90 .. +90
  var iLat = Math.round((lat + 90.0) * 100000);  // 5 decimal digits
  // lng: -180 .. +180
  var iLng = Math.round((lng + 180.0) * 100000);
  var idx = curve.xy2d(iLat, iLng);
  this.tree.insert(idx, { idx: idx, lat: lat, lng: lng, data: data} );
};

// supported args:
// -- no args --   - return all
// { lat: ..., lng: ... }  - return exact match
// { lat: ..., lng: ... }, { lat: ..., lng: ... }  - rectangle
// { lat: ..., lng: ... }, radius (in angles)  - circle
// { lat: ..., lng: ... }, radius, units (m, km, yd, mi) - circle
GeoTree.prototype.find = function(arg1, arg2, arg3) {
  var all, radius, validate;
  all = (0 === arguments.length);
  if (undefined === arg2) { arg2 = arg1; }
  if ('number' === typeof(arg2)) {
    var _tmp = getValidationFn(arg1, arg2, arg3);
    radius = _tmp.angle;
    validate = _tmp.validate;
  }
  var minLat, maxLat, minLng, maxLng, minIdx = -Infinity, maxIdx = Infinity;
  if (!all) {
    if (undefined === radius) {
      // rectangle
      minLat = Math.min(arg1.lat, arg2.lat);
      maxLat = Math.max(arg1.lat, arg2.lat);
      minLng = Math.min(arg1.lng, arg2.lng);
      maxLng = Math.max(arg1.lng, arg2.lng);
    } else {
      // circle
      minLat = Math.max(arg1.lat - radius, -90.0);
      maxLat = Math.min(arg1.lat + radius,  90.0);
      minLng = Math.max(arg1.lng - radius, -180.0);
      maxLng = Math.min(arg1.lng + radius,  180.0);
    }
    minIdx = curve.xy2d(Math.round((minLat + 90.0) * 100000),
                        Math.round((minLng + 180.0) * 100000));
    maxIdx = curve.xy2d(Math.round((maxLat + 90.0) * 100000),
                        Math.round((maxLng + 180.0) * 100000));
  }
  var candidates = this.tree.find(minIdx, maxIdx);
  var i, item, lat, lng, res = [];
  if (all) { for (i = 0; i < candidates.length; i++) { res.push(candidates[i].data); } }
  else {
    if (undefined === radius) {
      // rectangle
      for (i = 0; i < candidates.length; i++) {
        item = candidates[i];
        lat = item.lat;
        lng = item.lng;
        if (minLat <= lat && lat <= maxLat && minLng <= lng && lng <= maxLng) {
          res.push(item.data);
        }
      }
    } else {
      // circle
      for (i = 0; i < candidates.length; i++) {
        item = candidates[i];
        if (validate(item)) { res.push(item.data); }
      }
    }
  }
  return res;
};

// callback: function(data) { ... }
GeoTree.prototype.forEach = function(callback) {
  if (!callback) { return; }
  this.tree.forEach(function(item) { callback(item.data); });
};

// silent = true ... return string, else use console.log()
GeoTree.prototype.dump = function(silent) {
  return this.tree.dump(silent);
};

module.exports = GeoTree;

},{"./red-black":2,"./z-curve":3}],2:[function(_dereq_,module,exports){
// red-black tree implementation
//
// public API of RBTree:
// ---
// var rbt = new RBTree();  ... creates empty tree
// rbt.insert(...);         ... inserts (array of) (numeric)key-(any)value pair(s)
// rtb.find(...);           ... retuns array of values with respective keys in provided range
// rtb.forEach(cb);         ... in-order invocation of cb(value,key) on each item in the tree
// ---
// rbt.dump();              ... text dump of the tree (for debugging / testing purposes)
//


var RED = 0, BLACK = 1;

// --- NODE ---

function RBNode(parent, key, value) {
  this.parent = parent;
  this.key = key;
  this.values = [value];
  this.left = null;
  this.right = null;
  this.color = RED;
}

RBNode.prototype.getGrand = function() {
  return (this.parent ? this.parent.parent : null);
};

RBNode.prototype.getUncle = function() {
  var g = this.getGrand();
  return (g ? (g.left === this.parent ? g.right : g.left) : null);
};

RBNode.prototype.dump = function() {
  return '[k:' + this.key +
         ',c:' + (RED === this.color ? 'R' : 'B') +
         ',#:' + this.values.length +
         ',l:' + (this.left ? this.left.key : 'NULL') +
         ',r:' + (this.right ? this.right.key : 'NULL') +
         ',p:' + (this.parent ? this.parent.key : 'NULL') +
         ',v:' + JSON.stringify(this.values) + ']';
};

// --- TREE ---

function RBTree() {
  this.root = null;
}

// supported args (key is always numeric!):
// { key: ..., value: ... }  -- single object
// [ { key: ..., value: ... }, ... ]  -- array of the above objects
// key  -- 1 arg, value not provided
// key, value  -- 2 args
RBTree.prototype.insert = function(arg1, arg2) {
  if ('number' === typeof(arg1)) { this._insert(arg1, arg2); }
  else if ('object' === typeof(arg1)) {
    if ('number' === typeof(arg1.length)) {
      var ref;
      for (var i = 0; i < arg1.length; i++) {
        ref = arg1[i];
        this._insert(ref.key, ref.value);
      }
    } else { this._insert(arg1.key, arg1.value); }
  }
};

RBTree.prototype._insert = function(/* number */ key, value) {
  var n, p, g, u, pg;
  // insert
  if (!this.root) {
    n = this.root = new RBNode(null, key, value);
  } else {
    p = this.root;
    while (1) {
      if (p.key === key) {
        p.values.push(value); // same key --> no insert, just remember the value
        return;
      }
      if (key < p.key) {
        if (p.left) { p = p.left; }
        else { n = p.left = new RBNode(p, key, value); break; }
      } else {
        if (p.right) { p = p.right; }
        else { n = p.right = new RBNode(p, key, value); break; }
      }
    }
  }
  // balance
  g = n.getGrand(); u = n.getUncle();
  while (1) {
    if (!p) { n.color = BLACK; break; }
    if (BLACK === p.color) { break; }
    if (u && RED === u.color) {
      p.color = u.color = BLACK;
      g.color = RED;
      n = g; p = n.parent; g = n.getGrand(); u = n.getUncle();
      continue;
    }
    // n RED, p RED, (u BLACK), g BLACK
    if (n === p.right && p === g.left) {
      g.left = n; n.parent = g;
      if (p.right = n.left) { n.left.parent = p; }
      n.left = p; p.parent = n;
      n = p; p = n.parent;
    } else if (n === p.left && p === g.right) {
      g.right = n; n.parent = g;
      if (p.left = n.right) { n.right.parent = p; }
      n.right = p; p.parent = n;
      n = p; p = n.parent;
    }
    p.color = BLACK;
    g.color = RED;
    if (n === p.left) {
      if (g.left = p.right) { p.right.parent = g; }
      p.right = g;
    } else {
      if (g.right = p.left) { p.left.parent = g; }
      p.left = g;
    }
    pg = g.parent;
    if (pg) { if (g === pg.left) { pg.left = p; } else { pg.right = p; } }
    else { this.root = p; p.color = BLACK; }
    p.parent = pg; g.parent = p;
    break;
  }
};


// supported args:
// key  -- single numeric value, exact match
// start, end  -- two numberic values defining search range
RBTree.prototype.find = function(start, end) {
  if (!this.root) { return []; }
  if (end === undefined) { end = start; }
  var res = [];
  var node, stack = [this.root];
  while (stack.length) {
    node = stack.pop();
    if (node.key >= start && node.key <= end) { res.push(node.values); }
    if (node.right && node.key < end) { stack.push(node.right); }
    if (node.left && node.key > start) { stack.push(node.left); }
  }
  // flatten res:
  var flatRes = [], i, j, _ref;
  for (i = 0; i < res.length; i++) {
    _ref = res[i];
    for (j = 0; j < _ref.length; j++) { flatRes.push(_ref[j]); }
  }
  return flatRes;
};

// callback: function(data) { ... }
RBTree.prototype.forEach = function(callback) {
  function dfs(node) {
    if (!node) { return; }
    dfs(node.left);
    var ref = node.values, key = node.key;
    for (var i = 0; i < ref.length; i++) { callback(ref[i], key); }
    dfs(node.right);
  }
  if (!callback) { return; }
  dfs(this.root);
};

// TODO
// supported args (key always is numeric!):
// { key: ..., value: ... }  - single object
// [ { key: ..., value: ... }, ... ]  - array of the above objects
// key  - 1 arg, value not provided
// key, value  - 2 args
// RBTree.prototype.remove = function(arg1, arg2) {
  // TODO
// };

// RBTree.prototype._remove = function(key) {
// };

// silent = true ... return string, else use console.log()
// not unit-testing !silent branches (using console.log)
RBTree.prototype.dump = function(silent) {
  var res = '';
  function dumpNode(node, indent) {
    if (!node) { return; }
    /* istanbul ignore else */
    if (silent) { res += node.dump(); }
    else { console.log(((undefined !== indent) ? indent + '+ ' : '') + node.dump()); }
    var s = (undefined === indent) ? '' : (indent + '  ');
    dumpNode(node.left, s);
    dumpNode(node.right, s);
  }
  /* istanbul ignore if */
  if (!silent) { console.log('--- dump start ---'); }
  dumpNode(this.root);
  /* istanbul ignore if */
  if (!silent) { console.log('--- dump end ---'); }
  return res;
};

module.exports = RBTree;

},{}],3:[function(_dereq_,module,exports){
// z-curve implementation mapping 2D coordinates into 1D (single index) scalar
//

module.exports = {
  // (X,Y) --> idx
  // make sure the resulting float is 53 bits max to maintain the precision
  xy2d: function(x, y) {
    var bit = 1, max = Math.max(x,y), res = 0.0;
    while (bit <= max) { bit <<= 1; }
    bit >>= 1;
    while (bit) {
      res *= 2.0;
      if (x & bit) { res += 1.0; }
      res *= 2.0;
      if (y & bit) { res += 1.0; }
      bit >>= 1;
    }
    return res;
  }
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3JvbWFuL0Ryb3Bib3gvUHJvZ3MvUGVyc29uYWwvZ2l0aHViL2dlby10cmVlL3NyYy9nZW8tdHJlZS5qcyIsIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9zcmMvcmVkLWJsYWNrLmpzIiwiL1VzZXJzL3JvbWFuL0Ryb3Bib3gvUHJvZ3MvUGVyc29uYWwvZ2l0aHViL2dlby10cmVlL3NyYy96LWN1cnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBnZW8tdHJlZSBpbXBsZW1lbnRhdGlvbiAodXNpbmcgcmVkLWJsYWNrIHRyZWUgYW5kIHotY3VydmUpXG4vL1xuLy8gcHVibGljIEFQSSBvZiBHZW9UcmVlOlxuLy8gLS0tXG4vLyB2YXIgZ3QgPSBuZXcgR2VvVHJlZSgpOyAgLi4uIGNyZWF0ZSBlbXB0eSB0cmVlXG4vLyBndC5pbnNlcnQoLi4uKTsgICAgICAgICAgLi4uIGluc2VydHMgKGFycmF5IG9mKSB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4ufSBvYmplY3Qocylcbi8vIGd0LmZpbmQoLi4uKTsgICAgICAgICAgICAuLi4gcmV0dXJucyBhcnJheSBvZiBkYXRhIG9iamVjdHMgd2l0aCBzcGVjaWZpZWQgY29vcmRpbmF0ZXMgL1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbiBzcGVjaWZpZWQgcmVjdGFuZ2xlIC8gaW4gc3BlY2lmaWVkIGNpcmNsZVxuLy8gZ3QuZm9yRWFjaChjYik7ICAgICAgICAgIC4uLiBpbnZva2VzIGNiIGNhbGxiYWNrIG9uIGVhY2ggaW5zZXJ0ZWQgZGF0YSBvYmplY3QgaW4gdGhlIHRyZWVcbi8vIC0tLVxuLy8gZ3QuZHVtcCgpOyAgICAgICAgICAgICAgIC4uLiB0ZXh0IGR1bXAgb2YgdGhlIHRyZWUgKGZvciBkZWJ1Z2dpbmcgLyB0ZXN0aW5nIC8vIHB1cnBvc2VzKVxuXG52YXIgUkJUcmVlID0gcmVxdWlyZSgnLi9yZWQtYmxhY2snKTtcbnZhciBjdXJ2ZSA9IHJlcXVpcmUoJy4vei1jdXJ2ZScpO1xuXG4vLyAtLS0gaGVscGVyIGZ1bmN0aW9ucyAtLS1cblxuZnVuY3Rpb24gZ2V0VmFsaWRhdGlvbkZuKGNlbnRlciwgZGlzdCwgdW5pdHMpIHtcblxuICBmdW5jdGlvbiB0b0RlZyhyYWQpIHsgcmV0dXJuIHJhZCAqIDE4MC4wIC8gTWF0aC5QSTsgfVxuICBmdW5jdGlvbiB0b1JhZChkZWcpIHsgcmV0dXJuIGRlZyAqIE1hdGguUEkgLyAxODAuMDsgfVxuXG4gIC8vIG1lYW4gRWFydGggcmFkaXVzIChodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0VhcnRoX3JhZGl1cyNNZWFuX3JhZGl1cylcbiAgdmFyIFIgPSA2MzcxMDA5LjA7ICAvLyBpbiBtZXRlcnNcbiAgLy8gbWV0ZXIgdG8gWFxuICB2YXIgY29udmVyc2lvblRhYmxlID0gW1xuICAgIHsgdW5pdHM6ICdtJywgcmF0aW86IDEuMCB9LFxuICAgIHsgdW5pdHM6ICdrbScsIHJhdGlvOiAxMDAwLjAgfSxcbiAgICB7IHVuaXRzOiAneWQnLCByYXRpbzogMC45MTQ0IH0sXG4gICAgeyB1bml0czogJ21pJywgcmF0aW86IDE2MDkuMzQgfVxuICBdO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY29udmVyc2lvblRhYmxlLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNvbnZlcnNpb25UYWJsZVtpXS51bml0cyA9PT0gdW5pdHMpIHsgYnJlYWs7IH1cbiAgfVxuXG4gIC8vIGluIGFuZ2xlIGRlZ3JlZXMgYWxyZWFkeVxuICBpZiAoY29udmVyc2lvblRhYmxlLmxlbmd0aCA9PT0gaSkge1xuICAgIHZhciByYWRpdXMyID0gZGlzdCAqIGRpc3Q7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFuZ2xlOiBkaXN0LFxuICAgICAgdmFsaWRhdGU6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgICAgIHZhciBkbGF0ID0gY2VudGVyLmxhdCAtIGNvb3JkLmxhdDtcbiAgICAgICAgdmFyIGRsbmcgPSBjZW50ZXIubG5nIC0gY29vcmQubG5nO1xuICAgICAgICByZXR1cm4gKGRsYXQgKiBkbGF0ICsgZGxuZyAqIGRsbmcgPD0gcmFkaXVzMik7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIGRpc3RhbmNlLWJhc2VkXG4gIHZhciBhZGp1c3RlZERpc3QgPSBkaXN0ICogY29udmVyc2lvblRhYmxlW2ldLnJhdGlvOyAgLy8gaW4gbWV0ZXJzXG4gIHJldHVybiB7XG4gICAgYW5nbGU6IHRvRGVnKGFkanVzdGVkRGlzdCAvIChSICogTWF0aC5jb3ModG9SYWQoY2VudGVyLmxhdCkpKSksXG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgICAvLyBIYXZlcnNpbmUgYWxnbyAoaHR0cDovL21hdGhmb3J1bS5vcmcvbGlicmFyeS9kcm1hdGgvdmlldy81MTg3OS5odG1sKVxuICAgICAgdmFyIGRsYXQgPSB0b1JhZChjZW50ZXIubGF0IC0gY29vcmQubGF0KTtcbiAgICAgIHZhciBkbG5nID0gdG9SYWQoY2VudGVyLmxuZyAtIGNvb3JkLmxuZyk7XG4gICAgICB2YXIgc2luX2RsYXRfMiA9IE1hdGguc2luKGRsYXQvMik7XG4gICAgICB2YXIgc2luX2RsbmdfMiA9IE1hdGguc2luKGRsbmcvMik7XG4gICAgICB2YXIgY29zX2NlX2xhdCA9IE1hdGguY29zKHRvUmFkKGNlbnRlci5sYXQpKTtcbiAgICAgIHZhciBjb3NfY29fbGF0ID0gTWF0aC5jb3ModG9SYWQoY29vcmQubGF0KSk7XG4gICAgICB2YXIgYSA9IHNpbl9kbGF0XzIgKiBzaW5fZGxhdF8yICsgY29zX2NlX2xhdCAqIGNvc19jb19sYXQgKiBzaW5fZGxuZ18yICogc2luX2RsbmdfMjtcbiAgICAgIHZhciBjID0gMiAqIE1hdGguYXRhbjIoTWF0aC5zcXJ0KGEpLCBNYXRoLnNxcnQoMS1hKSk7XG4gICAgICByZXR1cm4gKFIgKiBjIDw9IGFkanVzdGVkRGlzdCk7XG4gICAgfVxuICB9O1xufVxuXG4vLyAtLS0gZW5kIG9mIGhlbHBlciBmdW5jdGlvbnMgLS0tXG5cbmZ1bmN0aW9uIEdlb1RyZWUoKSB7XG4gIHRoaXMudHJlZSA9IG5ldyBSQlRyZWUoKTtcbn1cblxuLy8gc3VwcG9ydGVkIGFyZ3M6XG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4uIH0gIC0gc2luZ2xlIG9iamVjdFxuLy8gWyB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4uIH0sIC4uLiBdICAtIGFycmF5IG9mIHRoZSBhYm92ZSBvYmplY3RzXG4vLyBsYXQsIGxuZywgZGF0YSAgLSAzIGFyZ3Ncbkdlb1RyZWUucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgdmFyIGxhdCwgbG5nLCBkYXRhO1xuICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcxKSkge1xuICAgIGxhdCA9IGFyZzE7XG4gICAgbG5nID0gYXJnMjtcbiAgICBkYXRhID0gYXJnMztcbiAgfSBlbHNlIGlmICgnb2JqZWN0JyA9PT0gdHlwZW9mKGFyZzEpKSB7XG4gICAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMS5sZW5ndGgpKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZzEubGVuZ3RoOyBpKyspIHsgdGhpcy5pbnNlcnQoYXJnMVtpXSk7IH1cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGF0ID0gYXJnMS5sYXQ7XG4gICAgICBsbmcgPSBhcmcxLmxuZztcbiAgICAgIGRhdGEgPSBhcmcxLmRhdGE7XG4gICAgfVxuICB9IGVsc2UgeyByZXR1cm47IH0gLy8gdW5zdXBwb3J0ZWQgYXJnc1xuICAvLyBsYXQ6IC05MCAuLiArOTBcbiAgdmFyIGlMYXQgPSBNYXRoLnJvdW5kKChsYXQgKyA5MC4wKSAqIDEwMDAwMCk7ICAvLyA1IGRlY2ltYWwgZGlnaXRzXG4gIC8vIGxuZzogLTE4MCAuLiArMTgwXG4gIHZhciBpTG5nID0gTWF0aC5yb3VuZCgobG5nICsgMTgwLjApICogMTAwMDAwKTtcbiAgdmFyIGlkeCA9IGN1cnZlLnh5MmQoaUxhdCwgaUxuZyk7XG4gIHRoaXMudHJlZS5pbnNlcnQoaWR4LCB7IGlkeDogaWR4LCBsYXQ6IGxhdCwgbG5nOiBsbmcsIGRhdGE6IGRhdGF9ICk7XG59O1xuXG4vLyBzdXBwb3J0ZWQgYXJnczpcbi8vIC0tIG5vIGFyZ3MgLS0gICAtIHJldHVybiBhbGxcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0gIC0gcmV0dXJuIGV4YWN0IG1hdGNoXG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiB9LCB7IGxhdDogLi4uLCBsbmc6IC4uLiB9ICAtIHJlY3RhbmdsZVxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSwgcmFkaXVzIChpbiBhbmdsZXMpICAtIGNpcmNsZVxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSwgcmFkaXVzLCB1bml0cyAobSwga20sIHlkLCBtaSkgLSBjaXJjbGVcbkdlb1RyZWUucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbihhcmcxLCBhcmcyLCBhcmczKSB7XG4gIHZhciBhbGwsIHJhZGl1cywgdmFsaWRhdGU7XG4gIGFsbCA9ICgwID09PSBhcmd1bWVudHMubGVuZ3RoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gYXJnMikgeyBhcmcyID0gYXJnMTsgfVxuICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcyKSkge1xuICAgIHZhciBfdG1wID0gZ2V0VmFsaWRhdGlvbkZuKGFyZzEsIGFyZzIsIGFyZzMpO1xuICAgIHJhZGl1cyA9IF90bXAuYW5nbGU7XG4gICAgdmFsaWRhdGUgPSBfdG1wLnZhbGlkYXRlO1xuICB9XG4gIHZhciBtaW5MYXQsIG1heExhdCwgbWluTG5nLCBtYXhMbmcsIG1pbklkeCA9IC1JbmZpbml0eSwgbWF4SWR4ID0gSW5maW5pdHk7XG4gIGlmICghYWxsKSB7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gcmFkaXVzKSB7XG4gICAgICAvLyByZWN0YW5nbGVcbiAgICAgIG1pbkxhdCA9IE1hdGgubWluKGFyZzEubGF0LCBhcmcyLmxhdCk7XG4gICAgICBtYXhMYXQgPSBNYXRoLm1heChhcmcxLmxhdCwgYXJnMi5sYXQpO1xuICAgICAgbWluTG5nID0gTWF0aC5taW4oYXJnMS5sbmcsIGFyZzIubG5nKTtcbiAgICAgIG1heExuZyA9IE1hdGgubWF4KGFyZzEubG5nLCBhcmcyLmxuZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNpcmNsZVxuICAgICAgbWluTGF0ID0gTWF0aC5tYXgoYXJnMS5sYXQgLSByYWRpdXMsIC05MC4wKTtcbiAgICAgIG1heExhdCA9IE1hdGgubWluKGFyZzEubGF0ICsgcmFkaXVzLCAgOTAuMCk7XG4gICAgICBtaW5MbmcgPSBNYXRoLm1heChhcmcxLmxuZyAtIHJhZGl1cywgLTE4MC4wKTtcbiAgICAgIG1heExuZyA9IE1hdGgubWluKGFyZzEubG5nICsgcmFkaXVzLCAgMTgwLjApO1xuICAgIH1cbiAgICBtaW5JZHggPSBjdXJ2ZS54eTJkKE1hdGgucm91bmQoKG1pbkxhdCArIDkwLjApICogMTAwMDAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoKG1pbkxuZyArIDE4MC4wKSAqIDEwMDAwMCkpO1xuICAgIG1heElkeCA9IGN1cnZlLnh5MmQoTWF0aC5yb3VuZCgobWF4TGF0ICsgOTAuMCkgKiAxMDAwMDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZCgobWF4TG5nICsgMTgwLjApICogMTAwMDAwKSk7XG4gIH1cbiAgdmFyIGNhbmRpZGF0ZXMgPSB0aGlzLnRyZWUuZmluZChtaW5JZHgsIG1heElkeCk7XG4gIHZhciBpLCBpdGVtLCBsYXQsIGxuZywgcmVzID0gW107XG4gIGlmIChhbGwpIHsgZm9yIChpID0gMDsgaSA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpKyspIHsgcmVzLnB1c2goY2FuZGlkYXRlc1tpXS5kYXRhKTsgfSB9XG4gIGVsc2Uge1xuICAgIGlmICh1bmRlZmluZWQgPT09IHJhZGl1cykge1xuICAgICAgLy8gcmVjdGFuZ2xlXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2FuZGlkYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVtID0gY2FuZGlkYXRlc1tpXTtcbiAgICAgICAgbGF0ID0gaXRlbS5sYXQ7XG4gICAgICAgIGxuZyA9IGl0ZW0ubG5nO1xuICAgICAgICBpZiAobWluTGF0IDw9IGxhdCAmJiBsYXQgPD0gbWF4TGF0ICYmIG1pbkxuZyA8PSBsbmcgJiYgbG5nIDw9IG1heExuZykge1xuICAgICAgICAgIHJlcy5wdXNoKGl0ZW0uZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2lyY2xlXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2FuZGlkYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVtID0gY2FuZGlkYXRlc1tpXTtcbiAgICAgICAgaWYgKHZhbGlkYXRlKGl0ZW0pKSB7IHJlcy5wdXNoKGl0ZW0uZGF0YSk7IH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbi8vIGNhbGxiYWNrOiBmdW5jdGlvbihkYXRhKSB7IC4uLiB9XG5HZW9UcmVlLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgaWYgKCFjYWxsYmFjaykgeyByZXR1cm47IH1cbiAgdGhpcy50cmVlLmZvckVhY2goZnVuY3Rpb24oaXRlbSkgeyBjYWxsYmFjayhpdGVtLmRhdGEpOyB9KTtcbn07XG5cbi8vIHNpbGVudCA9IHRydWUgLi4uIHJldHVybiBzdHJpbmcsIGVsc2UgdXNlIGNvbnNvbGUubG9nKClcbkdlb1RyZWUucHJvdG90eXBlLmR1bXAgPSBmdW5jdGlvbihzaWxlbnQpIHtcbiAgcmV0dXJuIHRoaXMudHJlZS5kdW1wKHNpbGVudCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdlb1RyZWU7XG4iLCIvLyByZWQtYmxhY2sgdHJlZSBpbXBsZW1lbnRhdGlvblxuLy9cbi8vIHB1YmxpYyBBUEkgb2YgUkJUcmVlOlxuLy8gLS0tXG4vLyB2YXIgcmJ0ID0gbmV3IFJCVHJlZSgpOyAgLi4uIGNyZWF0ZXMgZW1wdHkgdHJlZVxuLy8gcmJ0Lmluc2VydCguLi4pOyAgICAgICAgIC4uLiBpbnNlcnRzIChhcnJheSBvZikgKG51bWVyaWMpa2V5LShhbnkpdmFsdWUgcGFpcihzKVxuLy8gcnRiLmZpbmQoLi4uKTsgICAgICAgICAgIC4uLiByZXR1bnMgYXJyYXkgb2YgdmFsdWVzIHdpdGggcmVzcGVjdGl2ZSBrZXlzIGluIHByb3ZpZGVkIHJhbmdlXG4vLyBydGIuZm9yRWFjaChjYik7ICAgICAgICAgLi4uIGluLW9yZGVyIGludm9jYXRpb24gb2YgY2IodmFsdWUsa2V5KSBvbiBlYWNoIGl0ZW0gaW4gdGhlIHRyZWVcbi8vIC0tLVxuLy8gcmJ0LmR1bXAoKTsgICAgICAgICAgICAgIC4uLiB0ZXh0IGR1bXAgb2YgdGhlIHRyZWUgKGZvciBkZWJ1Z2dpbmcgLyB0ZXN0aW5nIHB1cnBvc2VzKVxuLy9cblxuXG52YXIgUkVEID0gMCwgQkxBQ0sgPSAxO1xuXG4vLyAtLS0gTk9ERSAtLS1cblxuZnVuY3Rpb24gUkJOb2RlKHBhcmVudCwga2V5LCB2YWx1ZSkge1xuICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgdGhpcy5rZXkgPSBrZXk7XG4gIHRoaXMudmFsdWVzID0gW3ZhbHVlXTtcbiAgdGhpcy5sZWZ0ID0gbnVsbDtcbiAgdGhpcy5yaWdodCA9IG51bGw7XG4gIHRoaXMuY29sb3IgPSBSRUQ7XG59XG5cblJCTm9kZS5wcm90b3R5cGUuZ2V0R3JhbmQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICh0aGlzLnBhcmVudCA/IHRoaXMucGFyZW50LnBhcmVudCA6IG51bGwpO1xufTtcblxuUkJOb2RlLnByb3RvdHlwZS5nZXRVbmNsZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZyA9IHRoaXMuZ2V0R3JhbmQoKTtcbiAgcmV0dXJuIChnID8gKGcubGVmdCA9PT0gdGhpcy5wYXJlbnQgPyBnLnJpZ2h0IDogZy5sZWZ0KSA6IG51bGwpO1xufTtcblxuUkJOb2RlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAnW2s6JyArIHRoaXMua2V5ICtcbiAgICAgICAgICcsYzonICsgKFJFRCA9PT0gdGhpcy5jb2xvciA/ICdSJyA6ICdCJykgK1xuICAgICAgICAgJywjOicgKyB0aGlzLnZhbHVlcy5sZW5ndGggK1xuICAgICAgICAgJyxsOicgKyAodGhpcy5sZWZ0ID8gdGhpcy5sZWZ0LmtleSA6ICdOVUxMJykgK1xuICAgICAgICAgJyxyOicgKyAodGhpcy5yaWdodCA/IHRoaXMucmlnaHQua2V5IDogJ05VTEwnKSArXG4gICAgICAgICAnLHA6JyArICh0aGlzLnBhcmVudCA/IHRoaXMucGFyZW50LmtleSA6ICdOVUxMJykgK1xuICAgICAgICAgJyx2OicgKyBKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlcykgKyAnXSc7XG59O1xuXG4vLyAtLS0gVFJFRSAtLS1cblxuZnVuY3Rpb24gUkJUcmVlKCkge1xuICB0aGlzLnJvb3QgPSBudWxsO1xufVxuXG4vLyBzdXBwb3J0ZWQgYXJncyAoa2V5IGlzIGFsd2F5cyBudW1lcmljISk6XG4vLyB7IGtleTogLi4uLCB2YWx1ZTogLi4uIH0gIC0tIHNpbmdsZSBvYmplY3Rcbi8vIFsgeyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9LCAuLi4gXSAgLS0gYXJyYXkgb2YgdGhlIGFib3ZlIG9iamVjdHNcbi8vIGtleSAgLS0gMSBhcmcsIHZhbHVlIG5vdCBwcm92aWRlZFxuLy8ga2V5LCB2YWx1ZSAgLS0gMiBhcmdzXG5SQlRyZWUucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMSkpIHsgdGhpcy5faW5zZXJ0KGFyZzEsIGFyZzIpOyB9XG4gIGVsc2UgaWYgKCdvYmplY3QnID09PSB0eXBlb2YoYXJnMSkpIHtcbiAgICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcxLmxlbmd0aCkpIHtcbiAgICAgIHZhciByZWY7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZzEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVmID0gYXJnMVtpXTtcbiAgICAgICAgdGhpcy5faW5zZXJ0KHJlZi5rZXksIHJlZi52YWx1ZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHsgdGhpcy5faW5zZXJ0KGFyZzEua2V5LCBhcmcxLnZhbHVlKTsgfVxuICB9XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLl9pbnNlcnQgPSBmdW5jdGlvbigvKiBudW1iZXIgKi8ga2V5LCB2YWx1ZSkge1xuICB2YXIgbiwgcCwgZywgdSwgcGc7XG4gIC8vIGluc2VydFxuICBpZiAoIXRoaXMucm9vdCkge1xuICAgIG4gPSB0aGlzLnJvb3QgPSBuZXcgUkJOb2RlKG51bGwsIGtleSwgdmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIHAgPSB0aGlzLnJvb3Q7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGlmIChwLmtleSA9PT0ga2V5KSB7XG4gICAgICAgIHAudmFsdWVzLnB1c2godmFsdWUpOyAvLyBzYW1lIGtleSAtLT4gbm8gaW5zZXJ0LCBqdXN0IHJlbWVtYmVyIHRoZSB2YWx1ZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoa2V5IDwgcC5rZXkpIHtcbiAgICAgICAgaWYgKHAubGVmdCkgeyBwID0gcC5sZWZ0OyB9XG4gICAgICAgIGVsc2UgeyBuID0gcC5sZWZ0ID0gbmV3IFJCTm9kZShwLCBrZXksIHZhbHVlKTsgYnJlYWs7IH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwLnJpZ2h0KSB7IHAgPSBwLnJpZ2h0OyB9XG4gICAgICAgIGVsc2UgeyBuID0gcC5yaWdodCA9IG5ldyBSQk5vZGUocCwga2V5LCB2YWx1ZSk7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIGJhbGFuY2VcbiAgZyA9IG4uZ2V0R3JhbmQoKTsgdSA9IG4uZ2V0VW5jbGUoKTtcbiAgd2hpbGUgKDEpIHtcbiAgICBpZiAoIXApIHsgbi5jb2xvciA9IEJMQUNLOyBicmVhazsgfVxuICAgIGlmIChCTEFDSyA9PT0gcC5jb2xvcikgeyBicmVhazsgfVxuICAgIGlmICh1ICYmIFJFRCA9PT0gdS5jb2xvcikge1xuICAgICAgcC5jb2xvciA9IHUuY29sb3IgPSBCTEFDSztcbiAgICAgIGcuY29sb3IgPSBSRUQ7XG4gICAgICBuID0gZzsgcCA9IG4ucGFyZW50OyBnID0gbi5nZXRHcmFuZCgpOyB1ID0gbi5nZXRVbmNsZSgpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIG4gUkVELCBwIFJFRCwgKHUgQkxBQ0spLCBnIEJMQUNLXG4gICAgaWYgKG4gPT09IHAucmlnaHQgJiYgcCA9PT0gZy5sZWZ0KSB7XG4gICAgICBnLmxlZnQgPSBuOyBuLnBhcmVudCA9IGc7XG4gICAgICBpZiAocC5yaWdodCA9IG4ubGVmdCkgeyBuLmxlZnQucGFyZW50ID0gcDsgfVxuICAgICAgbi5sZWZ0ID0gcDsgcC5wYXJlbnQgPSBuO1xuICAgICAgbiA9IHA7IHAgPSBuLnBhcmVudDtcbiAgICB9IGVsc2UgaWYgKG4gPT09IHAubGVmdCAmJiBwID09PSBnLnJpZ2h0KSB7XG4gICAgICBnLnJpZ2h0ID0gbjsgbi5wYXJlbnQgPSBnO1xuICAgICAgaWYgKHAubGVmdCA9IG4ucmlnaHQpIHsgbi5yaWdodC5wYXJlbnQgPSBwOyB9XG4gICAgICBuLnJpZ2h0ID0gcDsgcC5wYXJlbnQgPSBuO1xuICAgICAgbiA9IHA7IHAgPSBuLnBhcmVudDtcbiAgICB9XG4gICAgcC5jb2xvciA9IEJMQUNLO1xuICAgIGcuY29sb3IgPSBSRUQ7XG4gICAgaWYgKG4gPT09IHAubGVmdCkge1xuICAgICAgaWYgKGcubGVmdCA9IHAucmlnaHQpIHsgcC5yaWdodC5wYXJlbnQgPSBnOyB9XG4gICAgICBwLnJpZ2h0ID0gZztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGcucmlnaHQgPSBwLmxlZnQpIHsgcC5sZWZ0LnBhcmVudCA9IGc7IH1cbiAgICAgIHAubGVmdCA9IGc7XG4gICAgfVxuICAgIHBnID0gZy5wYXJlbnQ7XG4gICAgaWYgKHBnKSB7IGlmIChnID09PSBwZy5sZWZ0KSB7IHBnLmxlZnQgPSBwOyB9IGVsc2UgeyBwZy5yaWdodCA9IHA7IH0gfVxuICAgIGVsc2UgeyB0aGlzLnJvb3QgPSBwOyBwLmNvbG9yID0gQkxBQ0s7IH1cbiAgICBwLnBhcmVudCA9IHBnOyBnLnBhcmVudCA9IHA7XG4gICAgYnJlYWs7XG4gIH1cbn07XG5cblxuLy8gc3VwcG9ydGVkIGFyZ3M6XG4vLyBrZXkgIC0tIHNpbmdsZSBudW1lcmljIHZhbHVlLCBleGFjdCBtYXRjaFxuLy8gc3RhcnQsIGVuZCAgLS0gdHdvIG51bWJlcmljIHZhbHVlcyBkZWZpbmluZyBzZWFyY2ggcmFuZ2VcblJCVHJlZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF0aGlzLnJvb3QpIHsgcmV0dXJuIFtdOyB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkgeyBlbmQgPSBzdGFydDsgfVxuICB2YXIgcmVzID0gW107XG4gIHZhciBub2RlLCBzdGFjayA9IFt0aGlzLnJvb3RdO1xuICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgbm9kZSA9IHN0YWNrLnBvcCgpO1xuICAgIGlmIChub2RlLmtleSA+PSBzdGFydCAmJiBub2RlLmtleSA8PSBlbmQpIHsgcmVzLnB1c2gobm9kZS52YWx1ZXMpOyB9XG4gICAgaWYgKG5vZGUucmlnaHQgJiYgbm9kZS5rZXkgPCBlbmQpIHsgc3RhY2sucHVzaChub2RlLnJpZ2h0KTsgfVxuICAgIGlmIChub2RlLmxlZnQgJiYgbm9kZS5rZXkgPiBzdGFydCkgeyBzdGFjay5wdXNoKG5vZGUubGVmdCk7IH1cbiAgfVxuICAvLyBmbGF0dGVuIHJlczpcbiAgdmFyIGZsYXRSZXMgPSBbXSwgaSwgaiwgX3JlZjtcbiAgZm9yIChpID0gMDsgaSA8IHJlcy5sZW5ndGg7IGkrKykge1xuICAgIF9yZWYgPSByZXNbaV07XG4gICAgZm9yIChqID0gMDsgaiA8IF9yZWYubGVuZ3RoOyBqKyspIHsgZmxhdFJlcy5wdXNoKF9yZWZbal0pOyB9XG4gIH1cbiAgcmV0dXJuIGZsYXRSZXM7XG59O1xuXG4vLyBjYWxsYmFjazogZnVuY3Rpb24oZGF0YSkgeyAuLi4gfVxuUkJUcmVlLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgZnVuY3Rpb24gZGZzKG5vZGUpIHtcbiAgICBpZiAoIW5vZGUpIHsgcmV0dXJuOyB9XG4gICAgZGZzKG5vZGUubGVmdCk7XG4gICAgdmFyIHJlZiA9IG5vZGUudmFsdWVzLCBrZXkgPSBub2RlLmtleTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlZi5sZW5ndGg7IGkrKykgeyBjYWxsYmFjayhyZWZbaV0sIGtleSk7IH1cbiAgICBkZnMobm9kZS5yaWdodCk7XG4gIH1cbiAgaWYgKCFjYWxsYmFjaykgeyByZXR1cm47IH1cbiAgZGZzKHRoaXMucm9vdCk7XG59O1xuXG4vLyBUT0RPXG4vLyBzdXBwb3J0ZWQgYXJncyAoa2V5IGFsd2F5cyBpcyBudW1lcmljISk6XG4vLyB7IGtleTogLi4uLCB2YWx1ZTogLi4uIH0gIC0gc2luZ2xlIG9iamVjdFxuLy8gWyB7IGtleTogLi4uLCB2YWx1ZTogLi4uIH0sIC4uLiBdICAtIGFycmF5IG9mIHRoZSBhYm92ZSBvYmplY3RzXG4vLyBrZXkgIC0gMSBhcmcsIHZhbHVlIG5vdCBwcm92aWRlZFxuLy8ga2V5LCB2YWx1ZSAgLSAyIGFyZ3Ncbi8vIFJCVHJlZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24oYXJnMSwgYXJnMikge1xuICAvLyBUT0RPXG4vLyB9O1xuXG4vLyBSQlRyZWUucHJvdG90eXBlLl9yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHtcbi8vIH07XG5cbi8vIHNpbGVudCA9IHRydWUgLi4uIHJldHVybiBzdHJpbmcsIGVsc2UgdXNlIGNvbnNvbGUubG9nKClcbi8vIG5vdCB1bml0LXRlc3RpbmcgIXNpbGVudCBicmFuY2hlcyAodXNpbmcgY29uc29sZS5sb2cpXG5SQlRyZWUucHJvdG90eXBlLmR1bXAgPSBmdW5jdGlvbihzaWxlbnQpIHtcbiAgdmFyIHJlcyA9ICcnO1xuICBmdW5jdGlvbiBkdW1wTm9kZShub2RlLCBpbmRlbnQpIHtcbiAgICBpZiAoIW5vZGUpIHsgcmV0dXJuOyB9XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAoc2lsZW50KSB7IHJlcyArPSBub2RlLmR1bXAoKTsgfVxuICAgIGVsc2UgeyBjb25zb2xlLmxvZygoKHVuZGVmaW5lZCAhPT0gaW5kZW50KSA/IGluZGVudCArICcrICcgOiAnJykgKyBub2RlLmR1bXAoKSk7IH1cbiAgICB2YXIgcyA9ICh1bmRlZmluZWQgPT09IGluZGVudCkgPyAnJyA6IChpbmRlbnQgKyAnICAnKTtcbiAgICBkdW1wTm9kZShub2RlLmxlZnQsIHMpO1xuICAgIGR1bXBOb2RlKG5vZGUucmlnaHQsIHMpO1xuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXNpbGVudCkgeyBjb25zb2xlLmxvZygnLS0tIGR1bXAgc3RhcnQgLS0tJyk7IH1cbiAgZHVtcE5vZGUodGhpcy5yb290KTtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICghc2lsZW50KSB7IGNvbnNvbGUubG9nKCctLS0gZHVtcCBlbmQgLS0tJyk7IH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUkJUcmVlO1xuIiwiLy8gei1jdXJ2ZSBpbXBsZW1lbnRhdGlvbiBtYXBwaW5nIDJEIGNvb3JkaW5hdGVzIGludG8gMUQgKHNpbmdsZSBpbmRleCkgc2NhbGFyXG4vL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gKFgsWSkgLS0+IGlkeFxuICAvLyBtYWtlIHN1cmUgdGhlIHJlc3VsdGluZyBmbG9hdCBpcyA1MyBiaXRzIG1heCB0byBtYWludGFpbiB0aGUgcHJlY2lzaW9uXG4gIHh5MmQ6IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgYml0ID0gMSwgbWF4ID0gTWF0aC5tYXgoeCx5KSwgcmVzID0gMC4wO1xuICAgIHdoaWxlIChiaXQgPD0gbWF4KSB7IGJpdCA8PD0gMTsgfVxuICAgIGJpdCA+Pj0gMTtcbiAgICB3aGlsZSAoYml0KSB7XG4gICAgICByZXMgKj0gMi4wO1xuICAgICAgaWYgKHggJiBiaXQpIHsgcmVzICs9IDEuMDsgfVxuICAgICAgcmVzICo9IDIuMDtcbiAgICAgIGlmICh5ICYgYml0KSB7IHJlcyArPSAxLjA7IH1cbiAgICAgIGJpdCA+Pj0gMTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufTtcbiJdfQ==
(1)
});
