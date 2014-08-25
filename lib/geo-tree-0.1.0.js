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
GeoTree.prototype.find = function(arg1, arg2) {
  var all, radius;
  all = (0 === arguments.length);
  if (undefined === arg2) { arg2 = arg1; }
  if ('number' === typeof(arg2)) { radius = arg2; }
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
  this.tree.forEach(function(item) { callback(item.data); });
};

GeoTree.prototype.dump = function() {
  this.tree.dump();
};

module.exports = GeoTree;

},{"./red-black":2,"./z-curve":3}],2:[function(_dereq_,module,exports){
// red-black tree implementation
//
// public API of RBTree:
// ---
// var rbt = new RBTree();  ... creates empty tree
// rbt.insert(...);         ... inserts (array of) (numeric)key-(any)value pair(s)
// rtb.find(start, end);    ... retuns array of values with respective keys in provided range
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
    // n RED, p RED, u BLACK, g BLACK
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

RBTree.prototype.forEach = function(callback) {
  function dfs(node) {
    if (!node) { return; }
    dfs(node.left);
    var ref = node.values, key = node.key;
    for (var i = 0; i < ref.length; i++) { callback(ref[i], key); }
    dfs(node.right);
  }
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
RBTree.prototype.dump = function(silent) {
  var res = '';
  function dumpNode(node, indent) {
    if (!node) { return; }
    if (silent) { res += node.dump(); }
    else { console.log(((undefined !== indent) ? indent + '+ ' : '') + node.dump()); }
    var s = (undefined === indent) ? '' : (indent + '  ');
    dumpNode(node.left, s);
    dumpNode(node.right, s);
  }
  if (!silent) { console.log('--- dump start ---'); }
  dumpNode(this.root);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9yb21hbi9Ecm9wYm94L1Byb2dzL1BlcnNvbmFsL2doL2dlby10cmVlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvcm9tYW4vRHJvcGJveC9Qcm9ncy9QZXJzb25hbC9naC9nZW8tdHJlZS9zcmMvZ2VvLXRyZWUuanMiLCIvVXNlcnMvcm9tYW4vRHJvcGJveC9Qcm9ncy9QZXJzb25hbC9naC9nZW8tdHJlZS9zcmMvcmVkLWJsYWNrLmpzIiwiL1VzZXJzL3JvbWFuL0Ryb3Bib3gvUHJvZ3MvUGVyc29uYWwvZ2gvZ2VvLXRyZWUvc3JjL3otY3VydmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIGdlby10cmVlIGltcGxlbWVudGF0aW9uICh1c2luZyByZWQtYmxhY2sgdHJlZSBhbmQgei1jdXJ2ZSlcbi8vXG4vLyBwdWJsaWMgQVBJIG9mIEdlb1RyZWU6XG4vLyAtLS1cbi8vIHZhciBndCA9IG5ldyBHZW9UcmVlKCk7ICAuLi4gY3JlYXRlIGVtcHR5IHRyZWVcbi8vIGd0Lmluc2VydCguLi4pOyAgICAgICAgICAuLi4gaW5zZXJ0cyAoYXJyYXkgb2YpIHsgbGF0OiAuLi4sIGxuZzogLi4uLCBkYXRhOiAuLi59IG9iamVjdChzKVxuLy8gZ3QuZmluZCguLi4pOyAgICAgICAgICAgIC4uLiByZXR1cm5zIGFycmF5IG9mIGRhdGEgb2JqZWN0cyB3aXRoIHNwZWNpZmllZCBjb29yZGluYXRlcyAvXG4vLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluIHNwZWNpZmllZCByZWN0YW5nbGUgLyBpbiBzcGVjaWZpZWQgY2lyY2xlXG4vLyBndC5mb3JFYWNoKGNiKTsgICAgICAgICAgLi4uIGludm9rZXMgY2IgY2FsbGJhY2sgb24gZWFjaCBpbnNlcnRlZCBkYXRhIG9iamVjdCBpbiB0aGUgdHJlZVxuLy8gLS0tXG4vLyBndC5kdW1wKCk7ICAgICAgICAgICAgICAgLi4uIHRleHQgZHVtcCBvZiB0aGUgdHJlZSAoZm9yIGRlYnVnZ2luZyAvIHRlc3RpbmcgLy8gcHVycG9zZXMpXG5cbnZhciBSQlRyZWUgPSByZXF1aXJlKCcuL3JlZC1ibGFjaycpO1xudmFyIGN1cnZlID0gcmVxdWlyZSgnLi96LWN1cnZlJyk7XG5cbmZ1bmN0aW9uIEdlb1RyZWUoKSB7XG4gIHRoaXMudHJlZSA9IG5ldyBSQlRyZWUoKTtcbn1cblxuLy8gc3VwcG9ydGVkIGFyZ3M6XG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4uIH0gIC0gc2luZ2xlIG9iamVjdFxuLy8gWyB7IGxhdDogLi4uLCBsbmc6IC4uLiwgZGF0YTogLi4uIH0sIC4uLiBdICAtIGFycmF5IG9mIHRoZSBhYm92ZSBvYmplY3RzXG4vLyBsYXQsIGxuZywgZGF0YSAgLSAzIGFyZ3Ncbkdlb1RyZWUucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgdmFyIGxhdCwgbG5nLCBkYXRhO1xuICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcxKSkge1xuICAgIGxhdCA9IGFyZzE7XG4gICAgbG5nID0gYXJnMjtcbiAgICBkYXRhID0gYXJnMztcbiAgfSBlbHNlIGlmICgnb2JqZWN0JyA9PT0gdHlwZW9mKGFyZzEpKSB7XG4gICAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMS5sZW5ndGgpKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZzEubGVuZ3RoOyBpKyspIHsgdGhpcy5pbnNlcnQoYXJnMVtpXSk7IH1cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgbGF0ID0gYXJnMS5sYXQ7XG4gICAgICBsbmcgPSBhcmcxLmxuZztcbiAgICAgIGRhdGEgPSBhcmcxLmRhdGE7XG4gICAgfVxuICB9IGVsc2UgeyByZXR1cm47IH0gLy8gdW5zdXBwb3J0ZWQgYXJnc1xuICAvLyBsYXQ6IC05MCAuLiArOTBcbiAgdmFyIGlMYXQgPSBNYXRoLnJvdW5kKChsYXQgKyA5MC4wKSAqIDEwMDAwMCk7ICAvLyA1IGRlY2ltYWwgZGlnaXRzXG4gIC8vIGxuZzogLTE4MCAuLiArMTgwXG4gIHZhciBpTG5nID0gTWF0aC5yb3VuZCgobG5nICsgMTgwLjApICogMTAwMDAwKTtcbiAgdmFyIGlkeCA9IGN1cnZlLnh5MmQoaUxhdCwgaUxuZyk7XG4gIHRoaXMudHJlZS5pbnNlcnQoaWR4LCB7IGlkeDogaWR4LCBsYXQ6IGxhdCwgbG5nOiBsbmcsIGRhdGE6IGRhdGF9ICk7XG59O1xuXG4vLyBzdXBwb3J0ZWQgYXJnczpcbi8vIC0tIG5vIGFyZ3MgLS0gICAtIHJldHVybiBhbGxcbi8vIHsgbGF0OiAuLi4sIGxuZzogLi4uIH0gIC0gcmV0dXJuIGV4YWN0IG1hdGNoXG4vLyB7IGxhdDogLi4uLCBsbmc6IC4uLiB9LCB7IGxhdDogLi4uLCBsbmc6IC4uLiB9ICAtIHJlY3RhbmdsZVxuLy8geyBsYXQ6IC4uLiwgbG5nOiAuLi4gfSwgcmFkaXVzIChpbiBhbmdsZXMpICAtIGNpcmNsZVxuR2VvVHJlZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKGFyZzEsIGFyZzIpIHtcbiAgdmFyIGFsbCwgcmFkaXVzO1xuICBhbGwgPSAoMCA9PT0gYXJndW1lbnRzLmxlbmd0aCk7XG4gIGlmICh1bmRlZmluZWQgPT09IGFyZzIpIHsgYXJnMiA9IGFyZzE7IH1cbiAgaWYgKCdudW1iZXInID09PSB0eXBlb2YoYXJnMikpIHsgcmFkaXVzID0gYXJnMjsgfVxuICB2YXIgbWluTGF0LCBtYXhMYXQsIG1pbkxuZywgbWF4TG5nLCBtaW5JZHggPSAtSW5maW5pdHksIG1heElkeCA9IEluZmluaXR5O1xuICBpZiAoIWFsbCkge1xuICAgIGlmICh1bmRlZmluZWQgPT09IHJhZGl1cykge1xuICAgICAgLy8gcmVjdGFuZ2xlXG4gICAgICBtaW5MYXQgPSBNYXRoLm1pbihhcmcxLmxhdCwgYXJnMi5sYXQpO1xuICAgICAgbWF4TGF0ID0gTWF0aC5tYXgoYXJnMS5sYXQsIGFyZzIubGF0KTtcbiAgICAgIG1pbkxuZyA9IE1hdGgubWluKGFyZzEubG5nLCBhcmcyLmxuZyk7XG4gICAgICBtYXhMbmcgPSBNYXRoLm1heChhcmcxLmxuZywgYXJnMi5sbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjaXJjbGVcbiAgICAgIG1pbkxhdCA9IE1hdGgubWF4KGFyZzEubGF0IC0gcmFkaXVzLCAtOTAuMCk7XG4gICAgICBtYXhMYXQgPSBNYXRoLm1pbihhcmcxLmxhdCArIHJhZGl1cywgIDkwLjApO1xuICAgICAgbWluTG5nID0gTWF0aC5tYXgoYXJnMS5sbmcgLSByYWRpdXMsIC0xODAuMCk7XG4gICAgICBtYXhMbmcgPSBNYXRoLm1pbihhcmcxLmxuZyArIHJhZGl1cywgIDE4MC4wKTtcbiAgICB9XG4gICAgbWluSWR4ID0gY3VydmUueHkyZChNYXRoLnJvdW5kKChtaW5MYXQgKyA5MC4wKSAqIDEwMDAwMCksXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKChtaW5MbmcgKyAxODAuMCkgKiAxMDAwMDApKTtcbiAgICBtYXhJZHggPSBjdXJ2ZS54eTJkKE1hdGgucm91bmQoKG1heExhdCArIDkwLjApICogMTAwMDAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoKG1heExuZyArIDE4MC4wKSAqIDEwMDAwMCkpO1xuICB9XG4gIHZhciBjYW5kaWRhdGVzID0gdGhpcy50cmVlLmZpbmQobWluSWR4LCBtYXhJZHgpO1xuICB2YXIgaSwgaXRlbSwgbGF0LCBsbmcsIHJlcyA9IFtdO1xuICBpZiAoYWxsKSB7IGZvciAoaSA9IDA7IGkgPCBjYW5kaWRhdGVzLmxlbmd0aDsgaSsrKSB7IHJlcy5wdXNoKGNhbmRpZGF0ZXNbaV0uZGF0YSk7IH0gfVxuICBlbHNlIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSByYWRpdXMpIHtcbiAgICAgIC8vIHJlY3RhbmdsZVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNhbmRpZGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlbSA9IGNhbmRpZGF0ZXNbaV07XG4gICAgICAgIGxhdCA9IGl0ZW0ubGF0O1xuICAgICAgICBsbmcgPSBpdGVtLmxuZztcbiAgICAgICAgaWYgKG1pbkxhdCA8PSBsYXQgJiYgbGF0IDw9IG1heExhdCAmJiBtaW5MbmcgPD0gbG5nICYmIGxuZyA8PSBtYXhMbmcpIHtcbiAgICAgICAgICByZXMucHVzaChpdGVtLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGNpcmNsZVxuICAgICAgdmFyIHJhZGl1czIgPSByYWRpdXMgKiByYWRpdXM7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2FuZGlkYXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVtID0gY2FuZGlkYXRlc1tpXTtcbiAgICAgICAgbGF0ID0gYXJnMS5sYXQgLSBpdGVtLmxhdDtcbiAgICAgICAgbG5nID0gYXJnMS5sbmcgLSBpdGVtLmxuZztcbiAgICAgICAgaWYgKGxhdCAqIGxhdCArIGxuZyAqIGxuZyA8PSByYWRpdXMyKSB7IHJlcy5wdXNoKGl0ZW0uZGF0YSk7IH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbi8vIGNhbGxiYWNrOiBmdW5jdGlvbihkYXRhKSB7IC4uLiB9XG5HZW9UcmVlLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgdGhpcy50cmVlLmZvckVhY2goZnVuY3Rpb24oaXRlbSkgeyBjYWxsYmFjayhpdGVtLmRhdGEpOyB9KTtcbn07XG5cbkdlb1RyZWUucHJvdG90eXBlLmR1bXAgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy50cmVlLmR1bXAoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR2VvVHJlZTtcbiIsIi8vIHJlZC1ibGFjayB0cmVlIGltcGxlbWVudGF0aW9uXG4vL1xuLy8gcHVibGljIEFQSSBvZiBSQlRyZWU6XG4vLyAtLS1cbi8vIHZhciByYnQgPSBuZXcgUkJUcmVlKCk7ICAuLi4gY3JlYXRlcyBlbXB0eSB0cmVlXG4vLyByYnQuaW5zZXJ0KC4uLik7ICAgICAgICAgLi4uIGluc2VydHMgKGFycmF5IG9mKSAobnVtZXJpYylrZXktKGFueSl2YWx1ZSBwYWlyKHMpXG4vLyBydGIuZmluZChzdGFydCwgZW5kKTsgICAgLi4uIHJldHVucyBhcnJheSBvZiB2YWx1ZXMgd2l0aCByZXNwZWN0aXZlIGtleXMgaW4gcHJvdmlkZWQgcmFuZ2Vcbi8vIHJ0Yi5mb3JFYWNoKGNiKTsgICAgICAgICAuLi4gaW4tb3JkZXIgaW52b2NhdGlvbiBvZiBjYih2YWx1ZSxrZXkpIG9uIGVhY2ggaXRlbSBpbiB0aGUgdHJlZVxuLy8gLS0tXG4vLyByYnQuZHVtcCgpOyAgICAgICAgICAgICAgLi4uIHRleHQgZHVtcCBvZiB0aGUgdHJlZSAoZm9yIGRlYnVnZ2luZyAvIHRlc3RpbmcgcHVycG9zZXMpXG4vL1xuXG5cbnZhciBSRUQgPSAwLCBCTEFDSyA9IDE7XG5cbi8vIC0tLSBOT0RFIC0tLVxuXG5mdW5jdGlvbiBSQk5vZGUocGFyZW50LCBrZXksIHZhbHVlKSB7XG4gIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICB0aGlzLmtleSA9IGtleTtcbiAgdGhpcy52YWx1ZXMgPSBbdmFsdWVdO1xuICB0aGlzLmxlZnQgPSBudWxsO1xuICB0aGlzLnJpZ2h0ID0gbnVsbDtcbiAgdGhpcy5jb2xvciA9IFJFRDtcbn1cblxuUkJOb2RlLnByb3RvdHlwZS5nZXRHcmFuZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gKHRoaXMucGFyZW50ID8gdGhpcy5wYXJlbnQucGFyZW50IDogbnVsbCk7XG59O1xuXG5SQk5vZGUucHJvdG90eXBlLmdldFVuY2xlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBnID0gdGhpcy5nZXRHcmFuZCgpO1xuICByZXR1cm4gKGcgPyAoZy5sZWZ0ID09PSB0aGlzLnBhcmVudCA/IGcucmlnaHQgOiBnLmxlZnQpIDogbnVsbCk7XG59O1xuXG5SQk5vZGUucHJvdG90eXBlLmR1bXAgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICdbazonICsgdGhpcy5rZXkgK1xuICAgICAgICAgJyxjOicgKyAoUkVEID09PSB0aGlzLmNvbG9yID8gJ1InIDogJ0InKSArXG4gICAgICAgICAnLCM6JyArIHRoaXMudmFsdWVzLmxlbmd0aCArXG4gICAgICAgICAnLGw6JyArICh0aGlzLmxlZnQgPyB0aGlzLmxlZnQua2V5IDogJ05VTEwnKSArXG4gICAgICAgICAnLHI6JyArICh0aGlzLnJpZ2h0ID8gdGhpcy5yaWdodC5rZXkgOiAnTlVMTCcpICtcbiAgICAgICAgICcscDonICsgKHRoaXMucGFyZW50ID8gdGhpcy5wYXJlbnQua2V5IDogJ05VTEwnKSArXG4gICAgICAgICAnLHY6JyArIEpTT04uc3RyaW5naWZ5KHRoaXMudmFsdWVzKSArICddJztcbn07XG5cbi8vIC0tLSBUUkVFIC0tLVxuXG5mdW5jdGlvbiBSQlRyZWUoKSB7XG4gIHRoaXMucm9vdCA9IG51bGw7XG59XG5cbi8vIHN1cHBvcnRlZCBhcmdzIChrZXkgaXMgYWx3YXlzIG51bWVyaWMhKTpcbi8vIHsga2V5OiAuLi4sIHZhbHVlOiAuLi4gfSAgLS0gc2luZ2xlIG9iamVjdFxuLy8gWyB7IGtleTogLi4uLCB2YWx1ZTogLi4uIH0sIC4uLiBdICAtLSBhcnJheSBvZiB0aGUgYWJvdmUgb2JqZWN0c1xuLy8ga2V5ICAtLSAxIGFyZywgdmFsdWUgbm90IHByb3ZpZGVkXG4vLyBrZXksIHZhbHVlICAtLSAyIGFyZ3NcblJCVHJlZS5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24oYXJnMSwgYXJnMikge1xuICBpZiAoJ251bWJlcicgPT09IHR5cGVvZihhcmcxKSkgeyB0aGlzLl9pbnNlcnQoYXJnMSwgYXJnMik7IH1cbiAgZWxzZSBpZiAoJ29iamVjdCcgPT09IHR5cGVvZihhcmcxKSkge1xuICAgIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mKGFyZzEubGVuZ3RoKSkge1xuICAgICAgdmFyIHJlZjtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJnMS5sZW5ndGg7IGkrKykge1xuICAgICAgICByZWYgPSBhcmcxW2ldO1xuICAgICAgICB0aGlzLl9pbnNlcnQocmVmLmtleSwgcmVmLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgeyB0aGlzLl9pbnNlcnQoYXJnMS5rZXksIGFyZzEudmFsdWUpOyB9XG4gIH1cbn07XG5cblJCVHJlZS5wcm90b3R5cGUuX2luc2VydCA9IGZ1bmN0aW9uKC8qIG51bWJlciAqLyBrZXksIHZhbHVlKSB7XG4gIHZhciBuLCBwLCBnLCB1LCBwZztcbiAgLy8gaW5zZXJ0XG4gIGlmICghdGhpcy5yb290KSB7XG4gICAgbiA9IHRoaXMucm9vdCA9IG5ldyBSQk5vZGUobnVsbCwga2V5LCB2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgcCA9IHRoaXMucm9vdDtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgaWYgKHAua2V5ID09PSBrZXkpIHtcbiAgICAgICAgcC52YWx1ZXMucHVzaCh2YWx1ZSk7IC8vIHNhbWUga2V5IC0tPiBubyBpbnNlcnQsIGp1c3QgcmVtZW1iZXIgdGhlIHZhbHVlXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChrZXkgPCBwLmtleSkge1xuICAgICAgICBpZiAocC5sZWZ0KSB7IHAgPSBwLmxlZnQ7IH1cbiAgICAgICAgZWxzZSB7IG4gPSBwLmxlZnQgPSBuZXcgUkJOb2RlKHAsIGtleSwgdmFsdWUpOyBicmVhazsgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHAucmlnaHQpIHsgcCA9IHAucmlnaHQ7IH1cbiAgICAgICAgZWxzZSB7IG4gPSBwLnJpZ2h0ID0gbmV3IFJCTm9kZShwLCBrZXksIHZhbHVlKTsgYnJlYWs7IH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gYmFsYW5jZVxuICBnID0gbi5nZXRHcmFuZCgpOyB1ID0gbi5nZXRVbmNsZSgpO1xuICB3aGlsZSAoMSkge1xuICAgIGlmICghcCkgeyBuLmNvbG9yID0gQkxBQ0s7IGJyZWFrOyB9XG4gICAgaWYgKEJMQUNLID09PSBwLmNvbG9yKSB7IGJyZWFrOyB9XG4gICAgaWYgKHUgJiYgUkVEID09PSB1LmNvbG9yKSB7XG4gICAgICBwLmNvbG9yID0gdS5jb2xvciA9IEJMQUNLO1xuICAgICAgZy5jb2xvciA9IFJFRDtcbiAgICAgIG4gPSBnOyBwID0gbi5wYXJlbnQ7IGcgPSBuLmdldEdyYW5kKCk7IHUgPSBuLmdldFVuY2xlKCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gbiBSRUQsIHAgUkVELCB1IEJMQUNLLCBnIEJMQUNLXG4gICAgaWYgKG4gPT09IHAucmlnaHQgJiYgcCA9PT0gZy5sZWZ0KSB7XG4gICAgICBnLmxlZnQgPSBuOyBuLnBhcmVudCA9IGc7XG4gICAgICBpZiAocC5yaWdodCA9IG4ubGVmdCkgeyBuLmxlZnQucGFyZW50ID0gcDsgfVxuICAgICAgbi5sZWZ0ID0gcDsgcC5wYXJlbnQgPSBuO1xuICAgICAgbiA9IHA7IHAgPSBuLnBhcmVudDtcbiAgICB9IGVsc2UgaWYgKG4gPT09IHAubGVmdCAmJiBwID09PSBnLnJpZ2h0KSB7XG4gICAgICBnLnJpZ2h0ID0gbjsgbi5wYXJlbnQgPSBnO1xuICAgICAgaWYgKHAubGVmdCA9IG4ucmlnaHQpIHsgbi5yaWdodC5wYXJlbnQgPSBwOyB9XG4gICAgICBuLnJpZ2h0ID0gcDsgcC5wYXJlbnQgPSBuO1xuICAgICAgbiA9IHA7IHAgPSBuLnBhcmVudDtcbiAgICB9XG4gICAgcC5jb2xvciA9IEJMQUNLO1xuICAgIGcuY29sb3IgPSBSRUQ7XG4gICAgaWYgKG4gPT09IHAubGVmdCkge1xuICAgICAgaWYgKGcubGVmdCA9IHAucmlnaHQpIHsgcC5yaWdodC5wYXJlbnQgPSBnOyB9XG4gICAgICBwLnJpZ2h0ID0gZztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGcucmlnaHQgPSBwLmxlZnQpIHsgcC5sZWZ0LnBhcmVudCA9IGc7IH1cbiAgICAgIHAubGVmdCA9IGc7XG4gICAgfVxuICAgIHBnID0gZy5wYXJlbnQ7XG4gICAgaWYgKHBnKSB7IGlmIChnID09PSBwZy5sZWZ0KSB7IHBnLmxlZnQgPSBwOyB9IGVsc2UgeyBwZy5yaWdodCA9IHA7IH0gfVxuICAgIGVsc2UgeyB0aGlzLnJvb3QgPSBwOyBwLmNvbG9yID0gQkxBQ0s7IH1cbiAgICBwLnBhcmVudCA9IHBnOyBnLnBhcmVudCA9IHA7XG4gICAgYnJlYWs7XG4gIH1cbn07XG5cblJCVHJlZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF0aGlzLnJvb3QpIHsgcmV0dXJuIFtdOyB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkgeyBlbmQgPSBzdGFydDsgfVxuICB2YXIgcmVzID0gW107XG4gIHZhciBub2RlLCBzdGFjayA9IFt0aGlzLnJvb3RdO1xuICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgbm9kZSA9IHN0YWNrLnBvcCgpO1xuICAgIGlmIChub2RlLmtleSA+PSBzdGFydCAmJiBub2RlLmtleSA8PSBlbmQpIHsgcmVzLnB1c2gobm9kZS52YWx1ZXMpOyB9XG4gICAgaWYgKG5vZGUucmlnaHQgJiYgbm9kZS5rZXkgPCBlbmQpIHsgc3RhY2sucHVzaChub2RlLnJpZ2h0KTsgfVxuICAgIGlmIChub2RlLmxlZnQgJiYgbm9kZS5rZXkgPiBzdGFydCkgeyBzdGFjay5wdXNoKG5vZGUubGVmdCk7IH1cbiAgfVxuICAvLyBmbGF0dGVuIHJlczpcbiAgdmFyIGZsYXRSZXMgPSBbXSwgaSwgaiwgX3JlZjtcbiAgZm9yIChpID0gMDsgaSA8IHJlcy5sZW5ndGg7IGkrKykge1xuICAgIF9yZWYgPSByZXNbaV07XG4gICAgZm9yIChqID0gMDsgaiA8IF9yZWYubGVuZ3RoOyBqKyspIHsgZmxhdFJlcy5wdXNoKF9yZWZbal0pOyB9XG4gIH1cbiAgcmV0dXJuIGZsYXRSZXM7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBmdW5jdGlvbiBkZnMobm9kZSkge1xuICAgIGlmICghbm9kZSkgeyByZXR1cm47IH1cbiAgICBkZnMobm9kZS5sZWZ0KTtcbiAgICB2YXIgcmVmID0gbm9kZS52YWx1ZXMsIGtleSA9IG5vZGUua2V5O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVmLmxlbmd0aDsgaSsrKSB7IGNhbGxiYWNrKHJlZltpXSwga2V5KTsgfVxuICAgIGRmcyhub2RlLnJpZ2h0KTtcbiAgfVxuICBkZnModGhpcy5yb290KTtcbn07XG5cbi8vIFRPRE9cbi8vIHN1cHBvcnRlZCBhcmdzIChrZXkgYWx3YXlzIGlzIG51bWVyaWMhKTpcbi8vIHsga2V5OiAuLi4sIHZhbHVlOiAuLi4gfSAgLSBzaW5nbGUgb2JqZWN0XG4vLyBbIHsga2V5OiAuLi4sIHZhbHVlOiAuLi4gfSwgLi4uIF0gIC0gYXJyYXkgb2YgdGhlIGFib3ZlIG9iamVjdHNcbi8vIGtleSAgLSAxIGFyZywgdmFsdWUgbm90IHByb3ZpZGVkXG4vLyBrZXksIHZhbHVlICAtIDIgYXJnc1xuLy8gUkJUcmVlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihhcmcxLCBhcmcyKSB7XG4gIC8vIFRPRE9cbi8vIH07XG5cbi8vIFJCVHJlZS5wcm90b3R5cGUuX3JlbW92ZSA9IGZ1bmN0aW9uKGtleSkge1xuLy8gfTtcblxuLy8gc2lsZW50ID0gdHJ1ZSAuLi4gcmV0dXJuIHN0cmluZywgZWxzZSB1c2UgY29uc29sZS5sb2coKVxuUkJUcmVlLnByb3RvdHlwZS5kdW1wID0gZnVuY3Rpb24oc2lsZW50KSB7XG4gIHZhciByZXMgPSAnJztcbiAgZnVuY3Rpb24gZHVtcE5vZGUobm9kZSwgaW5kZW50KSB7XG4gICAgaWYgKCFub2RlKSB7IHJldHVybjsgfVxuICAgIGlmIChzaWxlbnQpIHsgcmVzICs9IG5vZGUuZHVtcCgpOyB9XG4gICAgZWxzZSB7IGNvbnNvbGUubG9nKCgodW5kZWZpbmVkICE9PSBpbmRlbnQpID8gaW5kZW50ICsgJysgJyA6ICcnKSArIG5vZGUuZHVtcCgpKTsgfVxuICAgIHZhciBzID0gKHVuZGVmaW5lZCA9PT0gaW5kZW50KSA/ICcnIDogKGluZGVudCArICcgICcpO1xuICAgIGR1bXBOb2RlKG5vZGUubGVmdCwgcyk7XG4gICAgZHVtcE5vZGUobm9kZS5yaWdodCwgcyk7XG4gIH1cbiAgaWYgKCFzaWxlbnQpIHsgY29uc29sZS5sb2coJy0tLSBkdW1wIHN0YXJ0IC0tLScpOyB9XG4gIGR1bXBOb2RlKHRoaXMucm9vdCk7XG4gIGlmICghc2lsZW50KSB7IGNvbnNvbGUubG9nKCctLS0gZHVtcCBlbmQgLS0tJyk7IH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUkJUcmVlO1xuIiwiLy8gei1jdXJ2ZSBpbXBsZW1lbnRhdGlvbiBtYXBwaW5nIDJEIGNvb3JkaW5hdGVzIGludG8gMUQgKHNpbmdsZSBpbmRleCkgc2NhbGFyXG4vL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gKFgsWSkgLS0+IGlkeFxuICAvLyBtYWtlIHN1cmUgdGhlIHJlc3VsdGluZyBmbG9hdCBpcyA1MyBiaXRzIG1heCB0byBtYWludGFpbiB0aGUgcHJlY2lzaW9uXG4gIHh5MmQ6IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICB2YXIgYml0ID0gMSwgbWF4ID0gTWF0aC5tYXgoeCx5KSwgcmVzID0gMC4wO1xuICAgIHdoaWxlIChiaXQgPD0gbWF4KSB7IGJpdCA8PD0gMTsgfVxuICAgIGJpdCA+Pj0gMTtcbiAgICB3aGlsZSAoYml0KSB7XG4gICAgICByZXMgKj0gMi4wO1xuICAgICAgaWYgKHggJiBiaXQpIHsgcmVzICs9IDEuMDsgfVxuICAgICAgcmVzICo9IDIuMDtcbiAgICAgIGlmICh5ICYgYml0KSB7IHJlcyArPSAxLjA7IH1cbiAgICAgIGJpdCA+Pj0gMTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufTtcbiJdfQ==
(1)
});
