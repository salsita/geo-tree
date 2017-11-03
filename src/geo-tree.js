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
        var dLat = center.lat - coord.lat;
        var dLng = center.lng - coord.lng;
        return (dLat * dLat + dLng * dLng <= radius2);
      }
    };
  }

  // distance-based
  var adjustedDist = dist * conversionTable[i].ratio;  // in meters
  return {
    angle: toDeg(adjustedDist / (R * Math.cos(toRad(center.lat)))),
    validate: function(coord) {
      // Haversine algo (http://mathforum.org/library/drmath/view/51879.html)
      var dLat = toRad(center.lat - coord.lat);
      var dLng = toRad(center.lng - coord.lng);
      var sinDLat2 = Math.sin(dLat / 2);
      var sinDLng2 = Math.sin(dLng / 2);
      var cosCeLat = Math.cos(toRad(center.lat));
      var cosCoLat = Math.cos(toRad(coord.lat));
      var a = sinDLat2 * sinDLat2 + cosCeLat * cosCoLat * sinDLng2 * sinDLng2;
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  if (typeof arg1 === 'number') {
    lat = arg1;
    lng = arg2;
    data = arg3;
  } else if (typeof arg1 === 'object') {
    if (typeof arg1.length === 'number') {
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
  this.tree.insert(idx, { idx: idx, lat: lat, lng: lng, data: data });
};

// supported args:
// -- no args --   - return all
// { lat: ..., lng: ... }  - return exact match
// { lat: ..., lng: ... }, { lat: ..., lng: ... }  - rectangle
// { lat: ..., lng: ... }, radius (in angles)  - circle
// { lat: ..., lng: ... }, radius, units (m, km, yd, mi) - circle
GeoTree.prototype.find = function(arg1, arg2, arg3) {
  var all, radius, validate;
  all = (arguments.length === 0);
  if (undefined === arg2) { arg2 = arg1; }
  if (typeof arg2 === 'number') {
    var _tmp = getValidationFn(arg1, arg2, arg3);
    radius = _tmp.angle;
    validate = _tmp.validate;
  }
  var minLat;
  var maxLat;
  var minLng;
  var maxLng;
  var minIdx = -Infinity;
  var maxIdx = Infinity;
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
    minIdx = curve.xy2d(Math.round((minLat + 90.0) * 100000), Math.round((minLng + 180.0) * 100000));
    maxIdx = curve.xy2d(Math.round((maxLat + 90.0) * 100000), Math.round((maxLng + 180.0) * 100000));
  }
  var candidates = this.tree.find(minIdx, maxIdx);
  var i;
  var item;
  var lat;
  var lng;
  var res = [];
  if (all) {
    for (i = 0; i < candidates.length; i++) { res.push(candidates[i].data); }
  } else {
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
