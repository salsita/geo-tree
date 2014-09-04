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

var RBTree = require('./red-black');
var curve = require('./z-curve');

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
  if (!callback) { return; }
  this.tree.forEach(function(item) { callback(item.data); });
};

// silent = true ... return string, else use console.log()
GeoTree.prototype.dump = function(silent) {
  return this.tree.dump(silent);
};

module.exports = GeoTree;
