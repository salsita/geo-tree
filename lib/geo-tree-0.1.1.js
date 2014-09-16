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

// WARNING: the conversion will work well only for small distances
function convertToAngle(lat, val, units) {
  var conversionTable = [
    { units: 'm', ratio: 1.0 },
    { units: 'km', ratio: 1000.0 },
    { units: 'yd', ratio: 0.9144 },
    { units: 'mi', ratio: 1609.34 }
  ];
  for (var i = 0; i < conversionTable.length; i++) {
    if (conversionTable[i].units === units) { break; }
  }
  if (conversionTable.length === i) { return val; }
  var angle = (val * conversionTable[i].ratio) / (6378137.0 * Math.cos(Math.PI * lat / 180.0));
  return angle * 180.0 / Math.PI;
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
  var all, radius;
  all = (0 === arguments.length);
  if (undefined === arg2) { arg2 = arg1; }
  if ('number' === typeof(arg2)) { radius = convertToAngle(arg1.lat, arg2, arg3); }
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
      var radius2 = radius * radius;
      for (i = 0; i < candidates.length; i++) {
        item = candidates[i];
        lat = arg1.lat - item.lat;
        lng = arg1.lng - item.lng;
        if (lat * lat + lng * lng <= radius2) { res.push(item.data); }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL3JvbWFuL0Ryb3Bib3gvUHJvZ3MvUGVyc29uYWwvZ2l0aHViL2dlby10cmVlL3NyYy9nZW8tdHJlZS5qcyIsIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2dpdGh1Yi9nZW8tdHJlZS9zcmMvcmVkLWJsYWNrLmpzIiwiL1VzZXJzL3JvbWFuL0Ryb3Bib3gvUHJvZ3MvUGVyc29uYWwvZ2l0aHViL2dlby10cmVlL3NyYy96LWN1cnZlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBnZW8tdHJlZSBpbXBsZW1lbnRhdGlvbiAodXNpbmcgcmVkLWJsYWNrIHRyZWUgYW5kIHotY3VydmUpXG4vL1xuLy8gcHVibGljIEFQSSBvZiBHZW9UcmVlOlxuLy8gLS0tXG4vLyB2YXIgZ3QgPSBuZXcgR2VvVHJlZSgpOyAgLi4uIGNyZWF0ZSBlbXB0eSB0cmVlXG4vLyBndC5pbnNlcnQoLi4uKTsgICAgICAgICAgLi4uIGluc2VydHMgKGFycmF5IG9mKSB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4ufSBvYmplY3Qocylcbi8vIGd0LmZpbmQoLi4uKTsgICAgICAgICAgICAuLi4gcmV0dXJucyBhcnJheSBvZiBkYXRhIG9iamVjdHMgd2l0aCBzcGVjaWZpZWQgY29vcmRpbmF0ZXMgL1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbiBzcGVjaWZpZWQgcmVjdGFuZ2xlIC8gaW4gc3BlY2lmaWVkIGNpcmNsZVxuLy8gZ3QuZm9yRWFjaChjYik7ICAgICAgICAgIC4uLiBpbnZva2VzIGNiIGNhbGxiYWNrIG9uIGVhY2ggaW5zZXJ0ZWQgZGF0YSBvYmplY3QgaW4gdGhlIHRyZWVcbi8vIC0tLVxuLy8gZ3QuZHVtcCgpOyAgICAgICAgICAgICAgIC4uLiB0ZXh0IGR1bXAgb2YgdGhlIHRyZWUgKGZvciBkZWJ1Z2dpbmcgLyB0ZXN0aW5nIC8vIHB1cnBvc2VzKVxuXG52YXIgUkJUcmVlID0gcmVxdWlyZSgnLi9yZWQtYmxhY2snKTtcbnZhciBjdXJ2ZSA9IHJlcXVpcmUoJy4vei1jdXJ2ZScpO1xuXG4vLyAtLS0gaGVscGVyIGZ1bmN0aW9ucyAtLS1cblxuLy8gV0FSTklORzogdGhlIGNvbnZlcnNpb24gd2lsbCB3b3JrIHdlbGwgb25seSBmb3Igc21hbGwgZGlzdGFuY2VzXG5mdW5jdGlvbiBjb252ZXJ0VG9BbmdsZShsYXQsIHZhbCwgdW5pdHMpIHtcbiAgdmFyIGNvbnZlcnNpb25UYWJsZSA9IFtcbiAgICB7IHVuaXRzOiAnbScsIHJhdGlvOiAxLjAgfSxcbiAgICB7IHVuaXRzOiAna20nLCByYXRpbzogMTAwMC4wIH0sXG4gICAgeyB1bml0czogJ3lkJywgcmF0aW86IDAuOTE0NCB9LFxuICAgIHsgdW5pdHM6ICdtaScsIHJhdGlvOiAxNjA5LjM0IH1cbiAgXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb252ZXJzaW9uVGFibGUubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoY29udmVyc2lvblRhYmxlW2ldLnVuaXRzID09PSB1bml0cykgeyBicmVhazsgfVxuICB9XG4gIGlmIChjb252ZXJzaW9uVGFibGUubGVuZ3RoID09PSBpKSB7IHJldHVybiB2YWw7IH1cbiAgdmFyIGFuZ2xlID0gKHZhbCAqIGNvbnZlcnNpb25UYWJsZVtpXS5yYXRpbykgLyAoNjM3ODEzNy4wICogTWF0aC5jb3MoTWF0aC5QSSAqIGxhdCAvIDE4MC4wKSk7XG4gIHJldHVybiBhbmdsZSAqIDE4MC4wIC8gTWF0aC5QSTtcbn1cblxuLy8gLS0tIGVuZCBvZiBoZWxwZXIgZnVuY3Rpb25zIC0tLVxuXG5mdW5jdGlvbiBHZW9UcmVlKCkge1xuICB0aGlzLnRyZWUgPSBuZXcgUkJUcmVlKCk7XG59XG5cbi8vIHN1cHBvcnRlZCBhcmdzOlxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4sIGRhdGE6IC4uLiB9ICAtIHNpbmdsZSBvYmplY3Rcbi8vIFsgeyBsYXQ6IC4uLiwgbG5nOiAuLi4sIGRhdGE6IC4uLiB9LCAuLi4gXSAgLSBhcnJheSBvZiB0aGUgYWJvdmUgb2JqZWN0c1xuLy8gbGF0LCBsbmcsIGRhdGEgIC0gMyBhcmdzXG5HZW9UcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihhcmcxLCBhcmcyLCBhcmczKSB7XG4gIHZhciBsYXQsIGxuZywgZGF0YTtcbiAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMSkpIHtcbiAgICBsYXQgPSBhcmcxO1xuICAgIGxuZyA9IGFyZzI7XG4gICAgZGF0YSA9IGFyZzM7XG4gIH0gZWxzZSBpZiAoJ29iamVjdCcgPT09IHR5cGVvZihhcmcxKSkge1xuICAgIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mKGFyZzEubGVuZ3RoKSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmcxLmxlbmd0aDsgaSsrKSB7IHRoaXMuaW5zZXJ0KGFyZzFbaV0pOyB9XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIGxhdCA9IGFyZzEubGF0O1xuICAgICAgbG5nID0gYXJnMS5sbmc7XG4gICAgICBkYXRhID0gYXJnMS5kYXRhO1xuICAgIH1cbiAgfSBlbHNlIHsgcmV0dXJuOyB9IC8vIHVuc3VwcG9ydGVkIGFyZ3NcbiAgLy8gbGF0OiAtOTAgLi4gKzkwXG4gIHZhciBpTGF0ID0gTWF0aC5yb3VuZCgobGF0ICsgOTAuMCkgKiAxMDAwMDApOyAgLy8gNSBkZWNpbWFsIGRpZ2l0c1xuICAvLyBsbmc6IC0xODAgLi4gKzE4MFxuICB2YXIgaUxuZyA9IE1hdGgucm91bmQoKGxuZyArIDE4MC4wKSAqIDEwMDAwMCk7XG4gIHZhciBpZHggPSBjdXJ2ZS54eTJkKGlMYXQsIGlMbmcpO1xuICB0aGlzLnRyZWUuaW5zZXJ0KGlkeCwgeyBpZHg6IGlkeCwgbGF0OiBsYXQsIGxuZzogbG5nLCBkYXRhOiBkYXRhfSApO1xufTtcblxuLy8gc3VwcG9ydGVkIGFyZ3M6XG4vLyAtLSBubyBhcmdzIC0tICAgLSByZXR1cm4gYWxsXG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiB9ICAtIHJldHVybiBleGFjdCBtYXRjaFxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSwgeyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSAgLSByZWN0YW5nbGVcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0sIHJhZGl1cyAoaW4gYW5nbGVzKSAgLSBjaXJjbGVcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0sIHJhZGl1cywgdW5pdHMgKG0sIGttLCB5ZCwgbWkpIC0gY2lyY2xlXG5HZW9UcmVlLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oYXJnMSwgYXJnMiwgYXJnMykge1xuICB2YXIgYWxsLCByYWRpdXM7XG4gIGFsbCA9ICgwID09PSBhcmd1bWVudHMubGVuZ3RoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gYXJnMikgeyBhcmcyID0gYXJnMTsgfVxuICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcyKSkgeyByYWRpdXMgPSBjb252ZXJ0VG9BbmdsZShhcmcxLmxhdCwgYXJnMiwgYXJnMyk7IH1cbiAgdmFyIG1pbkxhdCwgbWF4TGF0LCBtaW5MbmcsIG1heExuZywgbWluSWR4ID0gLUluZmluaXR5LCBtYXhJZHggPSBJbmZpbml0eTtcbiAgaWYgKCFhbGwpIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSByYWRpdXMpIHtcbiAgICAgIC8vIHJlY3RhbmdsZVxuICAgICAgbWluTGF0ID0gTWF0aC5taW4oYXJnMS5sYXQsIGFyZzIubGF0KTtcbiAgICAgIG1heExhdCA9IE1hdGgubWF4KGFyZzEubGF0LCBhcmcyLmxhdCk7XG4gICAgICBtaW5MbmcgPSBNYXRoLm1pbihhcmcxLmxuZywgYXJnMi5sbmcpO1xuICAgICAgbWF4TG5nID0gTWF0aC5tYXgoYXJnMS5sbmcsIGFyZzIubG5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY2lyY2xlXG4gICAgICBtaW5MYXQgPSBNYXRoLm1heChhcmcxLmxhdCAtIHJhZGl1cywgLTkwLjApO1xuICAgICAgbWF4TGF0ID0gTWF0aC5taW4oYXJnMS5sYXQgKyByYWRpdXMsICA5MC4wKTtcbiAgICAgIG1pbkxuZyA9IE1hdGgubWF4KGFyZzEubG5nIC0gcmFkaXVzLCAtMTgwLjApO1xuICAgICAgbWF4TG5nID0gTWF0aC5taW4oYXJnMS5sbmcgKyByYWRpdXMsICAxODAuMCk7XG4gICAgfVxuICAgIG1pbklkeCA9IGN1cnZlLnh5MmQoTWF0aC5yb3VuZCgobWluTGF0ICsgOTAuMCkgKiAxMDAwMDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZCgobWluTG5nICsgMTgwLjApICogMTAwMDAwKSk7XG4gICAgbWF4SWR4ID0gY3VydmUueHkyZChNYXRoLnJvdW5kKChtYXhMYXQgKyA5MC4wKSAqIDEwMDAwMCksXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKChtYXhMbmcgKyAxODAuMCkgKiAxMDAwMDApKTtcbiAgfVxuICB2YXIgY2FuZGlkYXRlcyA9IHRoaXMudHJlZS5maW5kKG1pbklkeCwgbWF4SWR4KTtcbiAgdmFyIGksIGl0ZW0sIGxhdCwgbG5nLCByZXMgPSBbXTtcbiAgaWYgKGFsbCkgeyBmb3IgKGkgPSAwOyBpIDwgY2FuZGlkYXRlcy5sZW5ndGg7IGkrKykgeyByZXMucHVzaChjYW5kaWRhdGVzW2ldLmRhdGEpOyB9IH1cbiAgZWxzZSB7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gcmFkaXVzKSB7XG4gICAgICAvLyByZWN0YW5nbGVcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYW5kaWRhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZW0gPSBjYW5kaWRhdGVzW2ldO1xuICAgICAgICBsYXQgPSBpdGVtLmxhdDtcbiAgICAgICAgbG5nID0gaXRlbS5sbmc7XG4gICAgICAgIGlmIChtaW5MYXQgPD0gbGF0ICYmIGxhdCA8PSBtYXhMYXQgJiYgbWluTG5nIDw9IGxuZyAmJiBsbmcgPD0gbWF4TG5nKSB7XG4gICAgICAgICAgcmVzLnB1c2goaXRlbS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaXJjbGVcbiAgICAgIHZhciByYWRpdXMyID0gcmFkaXVzICogcmFkaXVzO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlbSA9IGNhbmRpZGF0ZXNbaV07XG4gICAgICAgIGxhdCA9IGFyZzEubGF0IC0gaXRlbS5sYXQ7XG4gICAgICAgIGxuZyA9IGFyZzEubG5nIC0gaXRlbS5sbmc7XG4gICAgICAgIGlmIChsYXQgKiBsYXQgKyBsbmcgKiBsbmcgPD0gcmFkaXVzMikgeyByZXMucHVzaChpdGVtLmRhdGEpOyB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59O1xuXG4vLyBjYWxsYmFjazogZnVuY3Rpb24oZGF0YSkgeyAuLi4gfVxuR2VvVHJlZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGlmICghY2FsbGJhY2spIHsgcmV0dXJuOyB9XG4gIHRoaXMudHJlZS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHsgY2FsbGJhY2soaXRlbS5kYXRhKTsgfSk7XG59O1xuXG4vLyBzaWxlbnQgPSB0cnVlIC4uLiByZXR1cm4gc3RyaW5nLCBlbHNlIHVzZSBjb25zb2xlLmxvZygpXG5HZW9UcmVlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oc2lsZW50KSB7XG4gIHJldHVybiB0aGlzLnRyZWUuZHVtcChzaWxlbnQpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHZW9UcmVlO1xuIiwiLy8gcmVkLWJsYWNrIHRyZWUgaW1wbGVtZW50YXRpb25cbi8vXG4vLyBwdWJsaWMgQVBJIG9mIFJCVHJlZTpcbi8vIC0tLVxuLy8gdmFyIHJidCA9IG5ldyBSQlRyZWUoKTsgIC4uLiBjcmVhdGVzIGVtcHR5IHRyZWVcbi8vIHJidC5pbnNlcnQoLi4uKTsgICAgICAgICAuLi4gaW5zZXJ0cyAoYXJyYXkgb2YpIChudW1lcmljKWtleS0oYW55KXZhbHVlIHBhaXIocylcbi8vIHJ0Yi5maW5kKC4uLik7ICAgICAgICAgICAuLi4gcmV0dW5zIGFycmF5IG9mIHZhbHVlcyB3aXRoIHJlc3BlY3RpdmUga2V5cyBpbiBwcm92aWRlZCByYW5nZVxuLy8gcnRiLmZvckVhY2goY2IpOyAgICAgICAgIC4uLiBpbi1vcmRlciBpbnZvY2F0aW9uIG9mIGNiKHZhbHVlLGtleSkgb24gZWFjaCBpdGVtIGluIHRoZSB0cmVlXG4vLyAtLS1cbi8vIHJidC5kdW1wKCk7ICAgICAgICAgICAgICAuLi4gdGV4dCBkdW1wIG9mIHRoZSB0cmVlIChmb3IgZGVidWdnaW5nIC8gdGVzdGluZyBwdXJwb3Nlcylcbi8vXG5cblxudmFyIFJFRCA9IDAsIEJMQUNLID0gMTtcblxuLy8gLS0tIE5PREUgLS0tXG5cbmZ1bmN0aW9uIFJCTm9kZShwYXJlbnQsIGtleSwgdmFsdWUpIHtcbiAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gIHRoaXMua2V5ID0ga2V5O1xuICB0aGlzLnZhbHVlcyA9IFt2YWx1ZV07XG4gIHRoaXMubGVmdCA9IG51bGw7XG4gIHRoaXMucmlnaHQgPSBudWxsO1xuICB0aGlzLmNvbG9yID0gUkVEO1xufVxuXG5SQk5vZGUucHJvdG90eXBlLmdldEdyYW5kID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiAodGhpcy5wYXJlbnQgPyB0aGlzLnBhcmVudC5wYXJlbnQgOiBudWxsKTtcbn07XG5cblJCTm9kZS5wcm90b3R5cGUuZ2V0VW5jbGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGcgPSB0aGlzLmdldEdyYW5kKCk7XG4gIHJldHVybiAoZyA/IChnLmxlZnQgPT09IHRoaXMucGFyZW50ID8gZy5yaWdodCA6IGcubGVmdCkgOiBudWxsKTtcbn07XG5cblJCTm9kZS5wcm90b3R5cGUuZHVtcCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gJ1trOicgKyB0aGlzLmtleSArXG4gICAgICAgICAnLGM6JyArIChSRUQgPT09IHRoaXMuY29sb3IgPyAnUicgOiAnQicpICtcbiAgICAgICAgICcsIzonICsgdGhpcy52YWx1ZXMubGVuZ3RoICtcbiAgICAgICAgICcsbDonICsgKHRoaXMubGVmdCA/IHRoaXMubGVmdC5rZXkgOiAnTlVMTCcpICtcbiAgICAgICAgICcscjonICsgKHRoaXMucmlnaHQgPyB0aGlzLnJpZ2h0LmtleSA6ICdOVUxMJykgK1xuICAgICAgICAgJyxwOicgKyAodGhpcy5wYXJlbnQgPyB0aGlzLnBhcmVudC5rZXkgOiAnTlVMTCcpICtcbiAgICAgICAgICcsdjonICsgSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZXMpICsgJ10nO1xufTtcblxuLy8gLS0tIFRSRUUgLS0tXG5cbmZ1bmN0aW9uIFJCVHJlZSgpIHtcbiAgdGhpcy5yb290ID0gbnVsbDtcbn1cblxuLy8gc3VwcG9ydGVkIGFyZ3MgKGtleSBpcyBhbHdheXMgbnVtZXJpYyEpOlxuLy8geyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9ICAtLSBzaW5nbGUgb2JqZWN0XG4vLyBbIHsga2V5OiAuLi4sIHZhbHVlOiAuLi4gfSwgLi4uIF0gIC0tIGFycmF5IG9mIHRoZSBhYm92ZSBvYmplY3RzXG4vLyBrZXkgIC0tIDEgYXJnLCB2YWx1ZSBub3QgcHJvdmlkZWRcbi8vIGtleSwgdmFsdWUgIC0tIDIgYXJnc1xuUkJUcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mKGFyZzEpKSB7IHRoaXMuX2luc2VydChhcmcxLCBhcmcyKTsgfVxuICBlbHNlIGlmICgnb2JqZWN0JyA9PT0gdHlwZW9mKGFyZzEpKSB7XG4gICAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMS5sZW5ndGgpKSB7XG4gICAgICB2YXIgcmVmO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmcxLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlZiA9IGFyZzFbaV07XG4gICAgICAgIHRoaXMuX2luc2VydChyZWYua2V5LCByZWYudmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IHRoaXMuX2luc2VydChhcmcxLmtleSwgYXJnMS52YWx1ZSk7IH1cbiAgfVxufTtcblxuUkJUcmVlLnByb3RvdHlwZS5faW5zZXJ0ID0gZnVuY3Rpb24oLyogbnVtYmVyICovIGtleSwgdmFsdWUpIHtcbiAgdmFyIG4sIHAsIGcsIHUsIHBnO1xuICAvLyBpbnNlcnRcbiAgaWYgKCF0aGlzLnJvb3QpIHtcbiAgICBuID0gdGhpcy5yb290ID0gbmV3IFJCTm9kZShudWxsLCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBwID0gdGhpcy5yb290O1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBpZiAocC5rZXkgPT09IGtleSkge1xuICAgICAgICBwLnZhbHVlcy5wdXNoKHZhbHVlKTsgLy8gc2FtZSBrZXkgLS0+IG5vIGluc2VydCwganVzdCByZW1lbWJlciB0aGUgdmFsdWVcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA8IHAua2V5KSB7XG4gICAgICAgIGlmIChwLmxlZnQpIHsgcCA9IHAubGVmdDsgfVxuICAgICAgICBlbHNlIHsgbiA9IHAubGVmdCA9IG5ldyBSQk5vZGUocCwga2V5LCB2YWx1ZSk7IGJyZWFrOyB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocC5yaWdodCkgeyBwID0gcC5yaWdodDsgfVxuICAgICAgICBlbHNlIHsgbiA9IHAucmlnaHQgPSBuZXcgUkJOb2RlKHAsIGtleSwgdmFsdWUpOyBicmVhazsgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBiYWxhbmNlXG4gIGcgPSBuLmdldEdyYW5kKCk7IHUgPSBuLmdldFVuY2xlKCk7XG4gIHdoaWxlICgxKSB7XG4gICAgaWYgKCFwKSB7IG4uY29sb3IgPSBCTEFDSzsgYnJlYWs7IH1cbiAgICBpZiAoQkxBQ0sgPT09IHAuY29sb3IpIHsgYnJlYWs7IH1cbiAgICBpZiAodSAmJiBSRUQgPT09IHUuY29sb3IpIHtcbiAgICAgIHAuY29sb3IgPSB1LmNvbG9yID0gQkxBQ0s7XG4gICAgICBnLmNvbG9yID0gUkVEO1xuICAgICAgbiA9IGc7IHAgPSBuLnBhcmVudDsgZyA9IG4uZ2V0R3JhbmQoKTsgdSA9IG4uZ2V0VW5jbGUoKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICAvLyBuIFJFRCwgcCBSRUQsICh1IEJMQUNLKSwgZyBCTEFDS1xuICAgIGlmIChuID09PSBwLnJpZ2h0ICYmIHAgPT09IGcubGVmdCkge1xuICAgICAgZy5sZWZ0ID0gbjsgbi5wYXJlbnQgPSBnO1xuICAgICAgaWYgKHAucmlnaHQgPSBuLmxlZnQpIHsgbi5sZWZ0LnBhcmVudCA9IHA7IH1cbiAgICAgIG4ubGVmdCA9IHA7IHAucGFyZW50ID0gbjtcbiAgICAgIG4gPSBwOyBwID0gbi5wYXJlbnQ7XG4gICAgfSBlbHNlIGlmIChuID09PSBwLmxlZnQgJiYgcCA9PT0gZy5yaWdodCkge1xuICAgICAgZy5yaWdodCA9IG47IG4ucGFyZW50ID0gZztcbiAgICAgIGlmIChwLmxlZnQgPSBuLnJpZ2h0KSB7IG4ucmlnaHQucGFyZW50ID0gcDsgfVxuICAgICAgbi5yaWdodCA9IHA7IHAucGFyZW50ID0gbjtcbiAgICAgIG4gPSBwOyBwID0gbi5wYXJlbnQ7XG4gICAgfVxuICAgIHAuY29sb3IgPSBCTEFDSztcbiAgICBnLmNvbG9yID0gUkVEO1xuICAgIGlmIChuID09PSBwLmxlZnQpIHtcbiAgICAgIGlmIChnLmxlZnQgPSBwLnJpZ2h0KSB7IHAucmlnaHQucGFyZW50ID0gZzsgfVxuICAgICAgcC5yaWdodCA9IGc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChnLnJpZ2h0ID0gcC5sZWZ0KSB7IHAubGVmdC5wYXJlbnQgPSBnOyB9XG4gICAgICBwLmxlZnQgPSBnO1xuICAgIH1cbiAgICBwZyA9IGcucGFyZW50O1xuICAgIGlmIChwZykgeyBpZiAoZyA9PT0gcGcubGVmdCkgeyBwZy5sZWZ0ID0gcDsgfSBlbHNlIHsgcGcucmlnaHQgPSBwOyB9IH1cbiAgICBlbHNlIHsgdGhpcy5yb290ID0gcDsgcC5jb2xvciA9IEJMQUNLOyB9XG4gICAgcC5wYXJlbnQgPSBwZzsgZy5wYXJlbnQgPSBwO1xuICAgIGJyZWFrO1xuICB9XG59O1xuXG5cbi8vIHN1cHBvcnRlZCBhcmdzOlxuLy8ga2V5ICAtLSBzaW5nbGUgbnVtZXJpYyB2YWx1ZSwgZXhhY3QgbWF0Y2hcbi8vIHN0YXJ0LCBlbmQgIC0tIHR3byBudW1iZXJpYyB2YWx1ZXMgZGVmaW5pbmcgc2VhcmNoIHJhbmdlXG5SQlRyZWUucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbihzdGFydCwgZW5kKSB7XG4gIGlmICghdGhpcy5yb290KSB7IHJldHVybiBbXTsgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHsgZW5kID0gc3RhcnQ7IH1cbiAgdmFyIHJlcyA9IFtdO1xuICB2YXIgbm9kZSwgc3RhY2sgPSBbdGhpcy5yb290XTtcbiAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgIG5vZGUgPSBzdGFjay5wb3AoKTtcbiAgICBpZiAobm9kZS5rZXkgPj0gc3RhcnQgJiYgbm9kZS5rZXkgPD0gZW5kKSB7IHJlcy5wdXNoKG5vZGUudmFsdWVzKTsgfVxuICAgIGlmIChub2RlLnJpZ2h0ICYmIG5vZGUua2V5IDwgZW5kKSB7IHN0YWNrLnB1c2gobm9kZS5yaWdodCk7IH1cbiAgICBpZiAobm9kZS5sZWZ0ICYmIG5vZGUua2V5ID4gc3RhcnQpIHsgc3RhY2sucHVzaChub2RlLmxlZnQpOyB9XG4gIH1cbiAgLy8gZmxhdHRlbiByZXM6XG4gIHZhciBmbGF0UmVzID0gW10sIGksIGosIF9yZWY7XG4gIGZvciAoaSA9IDA7IGkgPCByZXMubGVuZ3RoOyBpKyspIHtcbiAgICBfcmVmID0gcmVzW2ldO1xuICAgIGZvciAoaiA9IDA7IGogPCBfcmVmLmxlbmd0aDsgaisrKSB7IGZsYXRSZXMucHVzaChfcmVmW2pdKTsgfVxuICB9XG4gIHJldHVybiBmbGF0UmVzO1xufTtcblxuLy8gY2FsbGJhY2s6IGZ1bmN0aW9uKGRhdGEpIHsgLi4uIH1cblJCVHJlZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIGZ1bmN0aW9uIGRmcyhub2RlKSB7XG4gICAgaWYgKCFub2RlKSB7IHJldHVybjsgfVxuICAgIGRmcyhub2RlLmxlZnQpO1xuICAgIHZhciByZWYgPSBub2RlLnZhbHVlcywga2V5ID0gbm9kZS5rZXk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZWYubGVuZ3RoOyBpKyspIHsgY2FsbGJhY2socmVmW2ldLCBrZXkpOyB9XG4gICAgZGZzKG5vZGUucmlnaHQpO1xuICB9XG4gIGlmICghY2FsbGJhY2spIHsgcmV0dXJuOyB9XG4gIGRmcyh0aGlzLnJvb3QpO1xufTtcblxuLy8gVE9ET1xuLy8gc3VwcG9ydGVkIGFyZ3MgKGtleSBhbHdheXMgaXMgbnVtZXJpYyEpOlxuLy8geyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9ICAtIHNpbmdsZSBvYmplY3Rcbi8vIFsgeyBrZXk6IC4uLiwgdmFsdWU6IC4uLiB9LCAuLi4gXSAgLSBhcnJheSBvZiB0aGUgYWJvdmUgb2JqZWN0c1xuLy8ga2V5ICAtIDEgYXJnLCB2YWx1ZSBub3QgcHJvdmlkZWRcbi8vIGtleSwgdmFsdWUgIC0gMiBhcmdzXG4vLyBSQlRyZWUucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgLy8gVE9ET1xuLy8gfTtcblxuLy8gUkJUcmVlLnByb3RvdHlwZS5fcmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7XG4vLyB9O1xuXG4vLyBzaWxlbnQgPSB0cnVlIC4uLiByZXR1cm4gc3RyaW5nLCBlbHNlIHVzZSBjb25zb2xlLmxvZygpXG4vLyBub3QgdW5pdC10ZXN0aW5nICFzaWxlbnQgYnJhbmNoZXMgKHVzaW5nIGNvbnNvbGUubG9nKVxuUkJUcmVlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oc2lsZW50KSB7XG4gIHZhciByZXMgPSAnJztcbiAgZnVuY3Rpb24gZHVtcE5vZGUobm9kZSwgaW5kZW50KSB7XG4gICAgaWYgKCFub2RlKSB7IHJldHVybjsgfVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgaWYgKHNpbGVudCkgeyByZXMgKz0gbm9kZS5kdW1wKCk7IH1cbiAgICBlbHNlIHsgY29uc29sZS5sb2coKCh1bmRlZmluZWQgIT09IGluZGVudCkgPyBpbmRlbnQgKyAnKyAnIDogJycpICsgbm9kZS5kdW1wKCkpOyB9XG4gICAgdmFyIHMgPSAodW5kZWZpbmVkID09PSBpbmRlbnQpID8gJycgOiAoaW5kZW50ICsgJyAgJyk7XG4gICAgZHVtcE5vZGUobm9kZS5sZWZ0LCBzKTtcbiAgICBkdW1wTm9kZShub2RlLnJpZ2h0LCBzKTtcbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKCFzaWxlbnQpIHsgY29uc29sZS5sb2coJy0tLSBkdW1wIHN0YXJ0IC0tLScpOyB9XG4gIGR1bXBOb2RlKHRoaXMucm9vdCk7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXNpbGVudCkgeyBjb25zb2xlLmxvZygnLS0tIGR1bXAgZW5kIC0tLScpOyB9XG4gIHJldHVybiByZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJCVHJlZTtcbiIsIi8vIHotY3VydmUgaW1wbGVtZW50YXRpb24gbWFwcGluZyAyRCBjb29yZGluYXRlcyBpbnRvIDFEIChzaW5nbGUgaW5kZXgpIHNjYWxhclxuLy9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8vIChYLFkpIC0tPiBpZHhcbiAgLy8gbWFrZSBzdXJlIHRoZSByZXN1bHRpbmcgZmxvYXQgaXMgNTMgYml0cyBtYXggdG8gbWFpbnRhaW4gdGhlIHByZWNpc2lvblxuICB4eTJkOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgdmFyIGJpdCA9IDEsIG1heCA9IE1hdGgubWF4KHgseSksIHJlcyA9IDAuMDtcbiAgICB3aGlsZSAoYml0IDw9IG1heCkgeyBiaXQgPDw9IDE7IH1cbiAgICBiaXQgPj49IDE7XG4gICAgd2hpbGUgKGJpdCkge1xuICAgICAgcmVzICo9IDIuMDtcbiAgICAgIGlmICh4ICYgYml0KSB7IHJlcyArPSAxLjA7IH1cbiAgICAgIHJlcyAqPSAyLjA7XG4gICAgICBpZiAoeSAmIGJpdCkgeyByZXMgKz0gMS4wOyB9XG4gICAgICBiaXQgPj49IDE7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cbn07XG4iXX0=
(1)
});
