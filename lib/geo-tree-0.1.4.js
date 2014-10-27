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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvcm9tYW4vRHJvcGJveC9Qcm9ncy9QZXJzb25hbC9naXRodWIvZ2VvLXRyZWUvc3JjL2Zha2VfMzA3MGYzNTYuanMiLCIvVXNlcnMvcm9tYW4vRHJvcGJveC9Qcm9ncy9QZXJzb25hbC9naXRodWIvZ2VvLXRyZWUvc3JjL3JlZC1ibGFjay5qcyIsIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9zcmMvei1jdXJ2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gZ2VvLXRyZWUgaW1wbGVtZW50YXRpb24gKHVzaW5nIHJlZC1ibGFjayB0cmVlIGFuZCB6LWN1cnZlKVxuLy9cbi8vIHB1YmxpYyBBUEkgb2YgR2VvVHJlZTpcbi8vIC0tLVxuLy8gdmFyIGd0ID0gbmV3IEdlb1RyZWUoKTsgIC4uLiBjcmVhdGUgZW1wdHkgdHJlZVxuLy8gZ3QuaW5zZXJ0KC4uLik7ICAgICAgICAgIC4uLiBpbnNlcnRzIChhcnJheSBvZikgeyBsYXQ6IC4uLiwgbG5nOiAuLi4sIGRhdGE6IC4uLn0gb2JqZWN0KHMpXG4vLyBndC5maW5kKC4uLik7ICAgICAgICAgICAgLi4uIHJldHVybnMgYXJyYXkgb2YgZGF0YSBvYmplY3RzIHdpdGggc3BlY2lmaWVkIGNvb3JkaW5hdGVzIC9cbi8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW4gc3BlY2lmaWVkIHJlY3RhbmdsZSAvIGluIHNwZWNpZmllZCBjaXJjbGVcbi8vIGd0LmZvckVhY2goY2IpOyAgICAgICAgICAuLi4gaW52b2tlcyBjYiBjYWxsYmFjayBvbiBlYWNoIGluc2VydGVkIGRhdGEgb2JqZWN0IGluIHRoZSB0cmVlXG4vLyAtLS1cbi8vIGd0LmR1bXAoKTsgICAgICAgICAgICAgICAuLi4gdGV4dCBkdW1wIG9mIHRoZSB0cmVlIChmb3IgZGVidWdnaW5nIC8gdGVzdGluZyAvLyBwdXJwb3NlcylcblxudmFyIFJCVHJlZSA9IHJlcXVpcmUoJy4vcmVkLWJsYWNrJyk7XG52YXIgY3VydmUgPSByZXF1aXJlKCcuL3otY3VydmUnKTtcblxuLy8gLS0tIGhlbHBlciBmdW5jdGlvbnMgLS0tXG5cbmZ1bmN0aW9uIGdldFZhbGlkYXRpb25GbihjZW50ZXIsIGRpc3QsIHVuaXRzKSB7XG5cbiAgZnVuY3Rpb24gdG9EZWcocmFkKSB7IHJldHVybiByYWQgKiAxODAuMCAvIE1hdGguUEk7IH1cbiAgZnVuY3Rpb24gdG9SYWQoZGVnKSB7IHJldHVybiBkZWcgKiBNYXRoLlBJIC8gMTgwLjA7IH1cblxuICAvLyBtZWFuIEVhcnRoIHJhZGl1cyAoaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FYXJ0aF9yYWRpdXMjTWVhbl9yYWRpdXMpXG4gIHZhciBSID0gNjM3MTAwOS4wOyAgLy8gaW4gbWV0ZXJzXG4gIC8vIG1ldGVyIHRvIFhcbiAgdmFyIGNvbnZlcnNpb25UYWJsZSA9IFtcbiAgICB7IHVuaXRzOiAnbScsIHJhdGlvOiAxLjAgfSxcbiAgICB7IHVuaXRzOiAna20nLCByYXRpbzogMTAwMC4wIH0sXG4gICAgeyB1bml0czogJ3lkJywgcmF0aW86IDAuOTE0NCB9LFxuICAgIHsgdW5pdHM6ICdtaScsIHJhdGlvOiAxNjA5LjM0IH1cbiAgXTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnZlcnNpb25UYWJsZS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChjb252ZXJzaW9uVGFibGVbaV0udW5pdHMgPT09IHVuaXRzKSB7IGJyZWFrOyB9XG4gIH1cblxuICAvLyBpbiBhbmdsZSBkZWdyZWVzIGFscmVhZHlcbiAgaWYgKGNvbnZlcnNpb25UYWJsZS5sZW5ndGggPT09IGkpIHtcbiAgICB2YXIgcmFkaXVzMiA9IGRpc3QgKiBkaXN0O1xuICAgIHJldHVybiB7XG4gICAgICBhbmdsZTogZGlzdCxcbiAgICAgIHZhbGlkYXRlOiBmdW5jdGlvbihjb29yZCkge1xuICAgICAgICB2YXIgZGxhdCA9IGNlbnRlci5sYXQgLSBjb29yZC5sYXQ7XG4gICAgICAgIHZhciBkbG5nID0gY2VudGVyLmxuZyAtIGNvb3JkLmxuZztcbiAgICAgICAgcmV0dXJuIChkbGF0ICogZGxhdCArIGRsbmcgKiBkbG5nIDw9IHJhZGl1czIpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvLyBkaXN0YW5jZS1iYXNlZFxuICB2YXIgYWRqdXN0ZWREaXN0ID0gZGlzdCAqIGNvbnZlcnNpb25UYWJsZVtpXS5yYXRpbzsgIC8vIGluIG1ldGVyc1xuICByZXR1cm4ge1xuICAgIGFuZ2xlOiB0b0RlZyhhZGp1c3RlZERpc3QgLyAoUiAqIE1hdGguY29zKHRvUmFkKGNlbnRlci5sYXQpKSkpLFxuICAgIHZhbGlkYXRlOiBmdW5jdGlvbihjb29yZCkge1xuICAgICAgLy8gSGF2ZXJzaW5lIGFsZ28gKGh0dHA6Ly9tYXRoZm9ydW0ub3JnL2xpYnJhcnkvZHJtYXRoL3ZpZXcvNTE4NzkuaHRtbClcbiAgICAgIHZhciBkbGF0ID0gdG9SYWQoY2VudGVyLmxhdCAtIGNvb3JkLmxhdCk7XG4gICAgICB2YXIgZGxuZyA9IHRvUmFkKGNlbnRlci5sbmcgLSBjb29yZC5sbmcpO1xuICAgICAgdmFyIHNpbl9kbGF0XzIgPSBNYXRoLnNpbihkbGF0LzIpO1xuICAgICAgdmFyIHNpbl9kbG5nXzIgPSBNYXRoLnNpbihkbG5nLzIpO1xuICAgICAgdmFyIGNvc19jZV9sYXQgPSBNYXRoLmNvcyh0b1JhZChjZW50ZXIubGF0KSk7XG4gICAgICB2YXIgY29zX2NvX2xhdCA9IE1hdGguY29zKHRvUmFkKGNvb3JkLmxhdCkpO1xuICAgICAgdmFyIGEgPSBzaW5fZGxhdF8yICogc2luX2RsYXRfMiArIGNvc19jZV9sYXQgKiBjb3NfY29fbGF0ICogc2luX2RsbmdfMiAqIHNpbl9kbG5nXzI7XG4gICAgICB2YXIgYyA9IDIgKiBNYXRoLmF0YW4yKE1hdGguc3FydChhKSwgTWF0aC5zcXJ0KDEtYSkpO1xuICAgICAgcmV0dXJuIChSICogYyA8PSBhZGp1c3RlZERpc3QpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gLS0tIGVuZCBvZiBoZWxwZXIgZnVuY3Rpb25zIC0tLVxuXG5mdW5jdGlvbiBHZW9UcmVlKCkge1xuICB0aGlzLnRyZWUgPSBuZXcgUkJUcmVlKCk7XG59XG5cbi8vIHN1cHBvcnRlZCBhcmdzOlxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4sIGRhdGE6IC4uLiB9ICAtIHNpbmdsZSBvYmplY3Rcbi8vIFsgeyBsYXQ6IC4uLiwgbG5nOiAuLi4sIGRhdGE6IC4uLiB9LCAuLi4gXSAgLSBhcnJheSBvZiB0aGUgYWJvdmUgb2JqZWN0c1xuLy8gbGF0LCBsbmcsIGRhdGEgIC0gMyBhcmdzXG5HZW9UcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihhcmcxLCBhcmcyLCBhcmczKSB7XG4gIHZhciBsYXQsIGxuZywgZGF0YTtcbiAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMSkpIHtcbiAgICBsYXQgPSBhcmcxO1xuICAgIGxuZyA9IGFyZzI7XG4gICAgZGF0YSA9IGFyZzM7XG4gIH0gZWxzZSBpZiAoJ29iamVjdCcgPT09IHR5cGVvZihhcmcxKSkge1xuICAgIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mKGFyZzEubGVuZ3RoKSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmcxLmxlbmd0aDsgaSsrKSB7IHRoaXMuaW5zZXJ0KGFyZzFbaV0pOyB9XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIGxhdCA9IGFyZzEubGF0O1xuICAgICAgbG5nID0gYXJnMS5sbmc7XG4gICAgICBkYXRhID0gYXJnMS5kYXRhO1xuICAgIH1cbiAgfSBlbHNlIHsgcmV0dXJuOyB9IC8vIHVuc3VwcG9ydGVkIGFyZ3NcbiAgLy8gbGF0OiAtOTAgLi4gKzkwXG4gIHZhciBpTGF0ID0gTWF0aC5yb3VuZCgobGF0ICsgOTAuMCkgKiAxMDAwMDApOyAgLy8gNSBkZWNpbWFsIGRpZ2l0c1xuICAvLyBsbmc6IC0xODAgLi4gKzE4MFxuICB2YXIgaUxuZyA9IE1hdGgucm91bmQoKGxuZyArIDE4MC4wKSAqIDEwMDAwMCk7XG4gIHZhciBpZHggPSBjdXJ2ZS54eTJkKGlMYXQsIGlMbmcpO1xuICB0aGlzLnRyZWUuaW5zZXJ0KGlkeCwgeyBpZHg6IGlkeCwgbGF0OiBsYXQsIGxuZzogbG5nLCBkYXRhOiBkYXRhfSApO1xufTtcblxuLy8gc3VwcG9ydGVkIGFyZ3M6XG4vLyAtLSBubyBhcmdzIC0tICAgLSByZXR1cm4gYWxsXG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiB9ICAtIHJldHVybiBleGFjdCBtYXRjaFxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSwgeyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSAgLSByZWN0YW5nbGVcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0sIHJhZGl1cyAoaW4gYW5nbGVzKSAgLSBjaXJjbGVcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0sIHJhZGl1cywgdW5pdHMgKG0sIGttLCB5ZCwgbWkpIC0gY2lyY2xlXG5HZW9UcmVlLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oYXJnMSwgYXJnMiwgYXJnMykge1xuICB2YXIgYWxsLCByYWRpdXMsIHZhbGlkYXRlO1xuICBhbGwgPSAoMCA9PT0gYXJndW1lbnRzLmxlbmd0aCk7XG4gIGlmICh1bmRlZmluZWQgPT09IGFyZzIpIHsgYXJnMiA9IGFyZzE7IH1cbiAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMikpIHtcbiAgICB2YXIgX3RtcCA9IGdldFZhbGlkYXRpb25GbihhcmcxLCBhcmcyLCBhcmczKTtcbiAgICByYWRpdXMgPSBfdG1wLmFuZ2xlO1xuICAgIHZhbGlkYXRlID0gX3RtcC52YWxpZGF0ZTtcbiAgfVxuICB2YXIgbWluTGF0LCBtYXhMYXQsIG1pbkxuZywgbWF4TG5nLCBtaW5JZHggPSAtSW5maW5pdHksIG1heElkeCA9IEluZmluaXR5O1xuICBpZiAoIWFsbCkge1xuICAgIGlmICh1bmRlZmluZWQgPT09IHJhZGl1cykge1xuICAgICAgLy8gcmVjdGFuZ2xlXG4gICAgICBtaW5MYXQgPSBNYXRoLm1pbihhcmcxLmxhdCwgYXJnMi5sYXQpO1xuICAgICAgbWF4TGF0ID0gTWF0aC5tYXgoYXJnMS5sYXQsIGFyZzIubGF0KTtcbiAgICAgIG1pbkxuZyA9IE1hdGgubWluKGFyZzEubG5nLCBhcmcyLmxuZyk7XG4gICAgICBtYXhMbmcgPSBNYXRoLm1heChhcmcxLmxuZywgYXJnMi5sbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaXJjbGVcbiAgICAgIG1pbkxhdCA9IE1hdGgubWF4KGFyZzEubGF0IC0gcmFkaXVzLCAtOTAuMCk7XG4gICAgICBtYXhMYXQgPSBNYXRoLm1pbihhcmcxLmxhdCArIHJhZGl1cywgIDkwLjApO1xuICAgICAgbWluTG5nID0gTWF0aC5tYXgoYXJnMS5sbmcgLSByYWRpdXMsIC0xODAuMCk7XG4gICAgICBtYXhMbmcgPSBNYXRoLm1pbihhcmcxLmxuZyArIHJhZGl1cywgIDE4MC4wKTtcbiAgICB9XG4gICAgbWluSWR4ID0gY3VydmUueHkyZChNYXRoLnJvdW5kKChtaW5MYXQgKyA5MC4wKSAqIDEwMDAwMCksXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKChtaW5MbmcgKyAxODAuMCkgKiAxMDAwMDApKTtcbiAgICBtYXhJZHggPSBjdXJ2ZS54eTJkKE1hdGgucm91bmQoKG1heExhdCArIDkwLjApICogMTAwMDAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoKG1heExuZyArIDE4MC4wKSAqIDEwMDAwMCkpO1xuICB9XG4gIHZhciBjYW5kaWRhdGVzID0gdGhpcy50cmVlLmZpbmQobWluSWR4LCBtYXhJZHgpO1xuICB2YXIgaSwgaXRlbSwgbGF0LCBsbmcsIHJlcyA9IFtdO1xuICBpZiAoYWxsKSB7IGZvciAoaSA9IDA7IGkgPCBjYW5kaWRhdGVzLmxlbmd0aDsgaSsrKSB7IHJlcy5wdXNoKGNhbmRpZGF0ZXNbaV0uZGF0YSk7IH0gfVxuICBlbHNlIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSByYWRpdXMpIHtcbiAgICAgIC8vIHJlY3RhbmdsZVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlbSA9IGNhbmRpZGF0ZXNbaV07XG4gICAgICAgIGxhdCA9IGl0ZW0ubGF0O1xuICAgICAgICBsbmcgPSBpdGVtLmxuZztcbiAgICAgICAgaWYgKG1pbkxhdCA8PSBsYXQgJiYgbGF0IDw9IG1heExhdCAmJiBtaW5MbmcgPD0gbG5nICYmIGxuZyA8PSBtYXhMbmcpIHtcbiAgICAgICAgICByZXMucHVzaChpdGVtLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNpcmNsZVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlbSA9IGNhbmRpZGF0ZXNbaV07XG4gICAgICAgIGlmICh2YWxpZGF0ZShpdGVtKSkgeyByZXMucHVzaChpdGVtLmRhdGEpOyB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59O1xuXG4vLyBjYWxsYmFjazogZnVuY3Rpb24oZGF0YSkgeyAuLi4gfVxuR2VvVHJlZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmICghY2FsbGJhY2spIHsgcmV0dXJuOyB9XG4gIHRoaXMudHJlZS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHsgY2FsbGJhY2soaXRlbS5kYXRhKTsgfSk7XG59O1xuXG4vLyBzaWxlbnQgPSB0cnVlIC4uLiByZXR1cm4gc3RyaW5nLCBlbHNlIHVzZSBjb25zb2xlLmxvZygpXG5HZW9UcmVlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oc2lsZW50KSB7XG4gIHJldHVybiB0aGlzLnRyZWUuZHVtcChzaWxlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHZW9UcmVlO1xuIiwiLy8gcmVkLWJsYWNrIHRyZWUgaW1wbGVtZW50YXRpb25cbi8vXG4vLyBwdWJsaWMgQVBJIG9mIFJCVHJlZTpcbi8vIC0tLVxuLy8gdmFyIHJidCA9IG5ldyBSQlRyZWUoKTsgIC4uLiBjcmVhdGVzIGVtcHR5IHRyZWVcbi8vIHJidC5pbnNlcnQoLi4uKTsgICAgICAgICAuLi4gaW5zZXJ0cyAoYXJyYXkgb2YpIChudW1lcmljKWtleS0oYW55KXZhbHVlIHBhaXIocylcbi8vIHJ0Yi5maW5kKC4uLik7ICAgICAgICAgICAuLi4gcmV0dW5zIGFycmF5IG9mIHZhbHVlcyB3aXRoIHJlc3BlY3RpdmUga2V5cyBpbiBwcm92aWRlZCByYW5nZVxuLy8gcnRiLmZvckVhY2goY2IpOyAgICAgICAgIC4uLiBpbi1vcmRlciBpbnZvY2F0aW9uIG9mIGNiKHZhbHVlLGtleSkgb24gZWFjaCBpdGVtIGluIHRoZSB0cmVlXG4vLyAtLS1cbi8vIHJidC5kdW1wKCk7ICAgICAgICAgICAgICAuLi4gdGV4dCBkdW1wIG9mIHRoZSB0cmVlIChmb3IgZGVidWdnaW5nIC8gdGVzdGluZyBwdXJwb3Nlcylcbi8vXG5cblxudmFyIFJFRCA9IDAsIEJMQUNLID0gMTtcblxuLy8gLS0tIE5PREUgLS0tXG5cbmZ1bmN0aW9uIFJCTm9kZShwYXJlbnQsIGtleSwgdmFsdWUpIHtcbiAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gIHRoaXMua2V5ID0ga2V5O1xuICB0aGlzLnZhbHVlcyA9IFt2YWx1ZV07XG4gIHRoaXMubGVmdCA9IG51bGw7XG4gIHRoaXMucmlnaHQgPSBudWxsO1xuICB0aGlzLmNvbG9yID0gUkVEO1xufVxuXG5SQk5vZGUucHJvdG90eXBlLmdldEdyYW5kID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAodGhpcy5wYXJlbnQgPyB0aGlzLnBhcmVudC5wYXJlbnQgOiBudWxsKTtcbn07XG5cblJCTm9kZS5wcm90b3R5cGUuZ2V0VW5jbGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGcgPSB0aGlzLmdldEdyYW5kKCk7XG4gIHJldHVybiAoZyA/IChnLmxlZnQgPT09IHRoaXMucGFyZW50ID8gZy5yaWdodCA6IGcubGVmdCkgOiBudWxsKTtcbn07XG5cblJCTm9kZS5wcm90b3R5cGUuZHVtcCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gJ1trOicgKyB0aGlzLmtleSArXG4gICAgICAgICAnLGM6JyArIChSRUQgPT09IHRoaXMuY29sb3IgPyAnUicgOiAnQicpICtcbiAgICAgICAgICcsIzonICsgdGhpcy52YWx1ZXMubGVuZ3RoICtcbiAgICAgICAgICcsbDonICsgKHRoaXMubGVmdCA/IHRoaXMubGVmdC5rZXkgOiAnTlVMTCcpICtcbiAgICAgICAgICcscjonICsgKHRoaXMucmlnaHQgPyB0aGlzLnJpZ2h0LmtleSA6ICdOVUxMJykgK1xuICAgICAgICAgJyxwOicgKyAodGhpcy5wYXJlbnQgPyB0aGlzLnBhcmVudC5rZXkgOiAnTlVMTCcpICtcbiAgICAgICAgICcsdjonICsgSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZXMpICsgJ10nO1xufTtcblxuLy8gLS0tIFRSRUUgLS0tXG5cbmZ1bmN0aW9uIFJCVHJlZSgpIHtcbiAgdGhpcy5yb290ID0gbnVsbDtcbn1cblxuLy8gc3VwcG9ydGVkIGFyZ3MgKGtleSBpcyBhbHdheXMgbnVtZXJpYyEpOlxuLy8geyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9ICAtLSBzaW5nbGUgb2JqZWN0XG4vLyBbIHsga2V5OiAuLi4sIHZhbHVlOiAuLi4gfSwgLi4uIF0gIC0tIGFycmF5IG9mIHRoZSBhYm92ZSBvYmplY3RzXG4vLyBrZXkgIC0tIDEgYXJnLCB2YWx1ZSBub3QgcHJvdmlkZWRcbi8vIGtleSwgdmFsdWUgIC0tIDIgYXJnc1xuUkJUcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mKGFyZzEpKSB7IHRoaXMuX2luc2VydChhcmcxLCBhcmcyKTsgfVxuICBlbHNlIGlmICgnb2JqZWN0JyA9PT0gdHlwZW9mKGFyZzEpKSB7XG4gICAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMS5sZW5ndGgpKSB7XG4gICAgICB2YXIgcmVmO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmcxLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlZiA9IGFyZzFbaV07XG4gICAgICAgIHRoaXMuX2luc2VydChyZWYua2V5LCByZWYudmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IHRoaXMuX2luc2VydChhcmcxLmtleSwgYXJnMS52YWx1ZSk7IH1cbiAgfVxufTtcblxuUkJUcmVlLnByb3RvdHlwZS5faW5zZXJ0ID0gZnVuY3Rpb24oLyogbnVtYmVyICovIGtleSwgdmFsdWUpIHtcbiAgdmFyIG4sIHAsIGcsIHUsIHBnO1xuICAvLyBpbnNlcnRcbiAgaWYgKCF0aGlzLnJvb3QpIHtcbiAgICBuID0gdGhpcy5yb290ID0gbmV3IFJCTm9kZShudWxsLCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBwID0gdGhpcy5yb290O1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBpZiAocC5rZXkgPT09IGtleSkge1xuICAgICAgICBwLnZhbHVlcy5wdXNoKHZhbHVlKTsgLy8gc2FtZSBrZXkgLS0+IG5vIGluc2VydCwganVzdCByZW1lbWJlciB0aGUgdmFsdWVcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA8IHAua2V5KSB7XG4gICAgICAgIGlmIChwLmxlZnQpIHsgcCA9IHAubGVmdDsgfVxuICAgICAgICBlbHNlIHsgbiA9IHAubGVmdCA9IG5ldyBSQk5vZGUocCwga2V5LCB2YWx1ZSk7IGJyZWFrOyB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocC5yaWdodCkgeyBwID0gcC5yaWdodDsgfVxuICAgICAgICBlbHNlIHsgbiA9IHAucmlnaHQgPSBuZXcgUkJOb2RlKHAsIGtleSwgdmFsdWUpOyBicmVhazsgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBiYWxhbmNlXG4gIGcgPSBuLmdldEdyYW5kKCk7IHUgPSBuLmdldFVuY2xlKCk7XG4gIHdoaWxlICgxKSB7XG4gICAgaWYgKCFwKSB7IG4uY29sb3IgPSBCTEFDSzsgYnJlYWs7IH1cbiAgICBpZiAoQkxBQ0sgPT09IHAuY29sb3IpIHsgYnJlYWs7IH1cbiAgICBpZiAodSAmJiBSRUQgPT09IHUuY29sb3IpIHtcbiAgICAgIHAuY29sb3IgPSB1LmNvbG9yID0gQkxBQ0s7XG4gICAgICBnLmNvbG9yID0gUkVEO1xuICAgICAgbiA9IGc7IHAgPSBuLnBhcmVudDsgZyA9IG4uZ2V0R3JhbmQoKTsgdSA9IG4uZ2V0VW5jbGUoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBuIFJFRCwgcCBSRUQsICh1IEJMQUNLKSwgZyBCTEFDS1xuICAgIGlmIChuID09PSBwLnJpZ2h0ICYmIHAgPT09IGcubGVmdCkge1xuICAgICAgZy5sZWZ0ID0gbjsgbi5wYXJlbnQgPSBnO1xuICAgICAgaWYgKHAucmlnaHQgPSBuLmxlZnQpIHsgbi5sZWZ0LnBhcmVudCA9IHA7IH1cbiAgICAgIG4ubGVmdCA9IHA7IHAucGFyZW50ID0gbjtcbiAgICAgIG4gPSBwOyBwID0gbi5wYXJlbnQ7XG4gICAgfSBlbHNlIGlmIChuID09PSBwLmxlZnQgJiYgcCA9PT0gZy5yaWdodCkge1xuICAgICAgZy5yaWdodCA9IG47IG4ucGFyZW50ID0gZztcbiAgICAgIGlmIChwLmxlZnQgPSBuLnJpZ2h0KSB7IG4ucmlnaHQucGFyZW50ID0gcDsgfVxuICAgICAgbi5yaWdodCA9IHA7IHAucGFyZW50ID0gbjtcbiAgICAgIG4gPSBwOyBwID0gbi5wYXJlbnQ7XG4gICAgfVxuICAgIHAuY29sb3IgPSBCTEFDSztcbiAgICBnLmNvbG9yID0gUkVEO1xuICAgIGlmIChuID09PSBwLmxlZnQpIHtcbiAgICAgIGlmIChnLmxlZnQgPSBwLnJpZ2h0KSB7IHAucmlnaHQucGFyZW50ID0gZzsgfVxuICAgICAgcC5yaWdodCA9IGc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChnLnJpZ2h0ID0gcC5sZWZ0KSB7IHAubGVmdC5wYXJlbnQgPSBnOyB9XG4gICAgICBwLmxlZnQgPSBnO1xuICAgIH1cbiAgICBwZyA9IGcucGFyZW50O1xuICAgIGlmIChwZykgeyBpZiAoZyA9PT0gcGcubGVmdCkgeyBwZy5sZWZ0ID0gcDsgfSBlbHNlIHsgcGcucmlnaHQgPSBwOyB9IH1cbiAgICBlbHNlIHsgdGhpcy5yb290ID0gcDsgcC5jb2xvciA9IEJMQUNLOyB9XG4gICAgcC5wYXJlbnQgPSBwZzsgZy5wYXJlbnQgPSBwO1xuICAgIGJyZWFrO1xuICB9XG59O1xuXG5cbi8vIHN1cHBvcnRlZCBhcmdzOlxuLy8ga2V5ICAtLSBzaW5nbGUgbnVtZXJpYyB2YWx1ZSwgZXhhY3QgbWF0Y2hcbi8vIHN0YXJ0LCBlbmQgIC0tIHR3byBudW1iZXJpYyB2YWx1ZXMgZGVmaW5pbmcgc2VhcmNoIHJhbmdlXG5SQlRyZWUucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbihzdGFydCwgZW5kKSB7XG4gIGlmICghdGhpcy5yb290KSB7IHJldHVybiBbXTsgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHsgZW5kID0gc3RhcnQ7IH1cbiAgdmFyIHJlcyA9IFtdO1xuICB2YXIgbm9kZSwgc3RhY2sgPSBbdGhpcy5yb290XTtcbiAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgIG5vZGUgPSBzdGFjay5wb3AoKTtcbiAgICBpZiAobm9kZS5rZXkgPj0gc3RhcnQgJiYgbm9kZS5rZXkgPD0gZW5kKSB7IHJlcy5wdXNoKG5vZGUudmFsdWVzKTsgfVxuICAgIGlmIChub2RlLnJpZ2h0ICYmIG5vZGUua2V5IDwgZW5kKSB7IHN0YWNrLnB1c2gobm9kZS5yaWdodCk7IH1cbiAgICBpZiAobm9kZS5sZWZ0ICYmIG5vZGUua2V5ID4gc3RhcnQpIHsgc3RhY2sucHVzaChub2RlLmxlZnQpOyB9XG4gIH1cbiAgLy8gZmxhdHRlbiByZXM6XG4gIHZhciBmbGF0UmVzID0gW10sIGksIGosIF9yZWY7XG4gIGZvciAoaSA9IDA7IGkgPCByZXMubGVuZ3RoOyBpKyspIHtcbiAgICBfcmVmID0gcmVzW2ldO1xuICAgIGZvciAoaiA9IDA7IGogPCBfcmVmLmxlbmd0aDsgaisrKSB7IGZsYXRSZXMucHVzaChfcmVmW2pdKTsgfVxuICB9XG4gIHJldHVybiBmbGF0UmVzO1xufTtcblxuLy8gY2FsbGJhY2s6IGZ1bmN0aW9uKGRhdGEpIHsgLi4uIH1cblJCVHJlZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGZ1bmN0aW9uIGRmcyhub2RlKSB7XG4gICAgaWYgKCFub2RlKSB7IHJldHVybjsgfVxuICAgIGRmcyhub2RlLmxlZnQpO1xuICAgIHZhciByZWYgPSBub2RlLnZhbHVlcywga2V5ID0gbm9kZS5rZXk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWYubGVuZ3RoOyBpKyspIHsgY2FsbGJhY2socmVmW2ldLCBrZXkpOyB9XG4gICAgZGZzKG5vZGUucmlnaHQpO1xuICB9XG4gIGlmICghY2FsbGJhY2spIHsgcmV0dXJuOyB9XG4gIGRmcyh0aGlzLnJvb3QpO1xufTtcblxuLy8gVE9ET1xuLy8gc3VwcG9ydGVkIGFyZ3MgKGtleSBhbHdheXMgaXMgbnVtZXJpYyEpOlxuLy8geyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9ICAtIHNpbmdsZSBvYmplY3Rcbi8vIFsgeyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9LCAuLi4gXSAgLSBhcnJheSBvZiB0aGUgYWJvdmUgb2JqZWN0c1xuLy8ga2V5ICAtIDEgYXJnLCB2YWx1ZSBub3QgcHJvdmlkZWRcbi8vIGtleSwgdmFsdWUgIC0gMiBhcmdzXG4vLyBSQlRyZWUucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgLy8gVE9ET1xuLy8gfTtcblxuLy8gUkJUcmVlLnByb3RvdHlwZS5fcmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7XG4vLyB9O1xuXG4vLyBzaWxlbnQgPSB0cnVlIC4uLiByZXR1cm4gc3RyaW5nLCBlbHNlIHVzZSBjb25zb2xlLmxvZygpXG4vLyBub3QgdW5pdC10ZXN0aW5nICFzaWxlbnQgYnJhbmNoZXMgKHVzaW5nIGNvbnNvbGUubG9nKVxuUkJUcmVlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oc2lsZW50KSB7XG4gIHZhciByZXMgPSAnJztcbiAgZnVuY3Rpb24gZHVtcE5vZGUobm9kZSwgaW5kZW50KSB7XG4gICAgaWYgKCFub2RlKSB7IHJldHVybjsgfVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKHNpbGVudCkgeyByZXMgKz0gbm9kZS5kdW1wKCk7IH1cbiAgICBlbHNlIHsgY29uc29sZS5sb2coKCh1bmRlZmluZWQgIT09IGluZGVudCkgPyBpbmRlbnQgKyAnKyAnIDogJycpICsgbm9kZS5kdW1wKCkpOyB9XG4gICAgdmFyIHMgPSAodW5kZWZpbmVkID09PSBpbmRlbnQpID8gJycgOiAoaW5kZW50ICsgJyAgJyk7XG4gICAgZHVtcE5vZGUobm9kZS5sZWZ0LCBzKTtcbiAgICBkdW1wTm9kZShub2RlLnJpZ2h0LCBzKTtcbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKCFzaWxlbnQpIHsgY29uc29sZS5sb2coJy0tLSBkdW1wIHN0YXJ0IC0tLScpOyB9XG4gIGR1bXBOb2RlKHRoaXMucm9vdCk7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXNpbGVudCkgeyBjb25zb2xlLmxvZygnLS0tIGR1bXAgZW5kIC0tLScpOyB9XG4gIHJldHVybiByZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJCVHJlZTtcbiIsIi8vIHotY3VydmUgaW1wbGVtZW50YXRpb24gbWFwcGluZyAyRCBjb29yZGluYXRlcyBpbnRvIDFEIChzaW5nbGUgaW5kZXgpIHNjYWxhclxuLy9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8vIChYLFkpIC0tPiBpZHhcbiAgLy8gbWFrZSBzdXJlIHRoZSByZXN1bHRpbmcgZmxvYXQgaXMgNTMgYml0cyBtYXggdG8gbWFpbnRhaW4gdGhlIHByZWNpc2lvblxuICB4eTJkOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgdmFyIGJpdCA9IDEsIG1heCA9IE1hdGgubWF4KHgseSksIHJlcyA9IDAuMDtcbiAgICB3aGlsZSAoYml0IDw9IG1heCkgeyBiaXQgPDw9IDE7IH1cbiAgICBiaXQgPj49IDE7XG4gICAgd2hpbGUgKGJpdCkge1xuICAgICAgcmVzICo9IDIuMDtcbiAgICAgIGlmICh4ICYgYml0KSB7IHJlcyArPSAxLjA7IH1cbiAgICAgIHJlcyAqPSAyLjA7XG4gICAgICBpZiAoeSAmIGJpdCkgeyByZXMgKz0gMS4wOyB9XG4gICAgICBiaXQgPj49IDE7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cbn07XG4iXX0=
(1)
});
