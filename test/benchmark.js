// Usage: node benchmark
//
// Some benchmark tests to make sure some code "improvement" doesn't affect
// performance. If it does --> rollback the changes and try to implement the new
// functionality in some other way...

var RBTree = require('../src/red-black');
var N = 1 << 20;

function benchmark(name, data, sort) {
  var i;
  var tsStart;
  var tsEnd;
  var tree = new RBTree();
  console.log('\ndistribution "' + name + '":');
  // insert
  tsStart = new Date();
  tree.insert(data, sort);
  tsEnd = new Date();
  console.log('insert (1M) ... ' + (tsEnd - tsStart) + 'ms');
  // find one
  tsStart = new Date();
  for (i = 0; i < N / 4; i++) { tree.find(i * 4); }
  tsEnd = new Date();
  console.log('find-one (250k) ... ' + (tsEnd - tsStart) + 'ms');
  // find range
  tsStart = new Date();
  for (i = 0; i < N / 1024; i++) { tree.find(i * 1024, i * 1024 + 10240); }
  tsEnd = new Date();
  console.log('find-range (1k x 10k) ... ' + (tsEnd - tsStart) + 'ms');
  //
  tree = null;
}

var i, arr;

arr = [];
for (i = 0; i < N; i++) { arr.push({ key: i }); }
benchmark('linear', arr);

arr = [];
for (i = 0; i < N; i++) { arr.push({key: Math.floor(Math.random() * N)}); }
benchmark('random', arr);

arr = [];
for (i = 0; i < N - 1; i++) { arr.push(i); }
var _arr = [];
var step = N;
var idx;
while (step > 1) {
  idx = step / 2 - 1;
  while (idx < N - 1) { _arr.push({ key: arr[idx] }); idx += step; }
  step /= 2;
}
benchmark('binarized', _arr);

console.log('\n------------------------------------------------------------\n');

var GeoTree = require('../src/geo-tree');
var tree = new GeoTree();
var tsStart, tsEnd;

console.log('START');
tsStart = new Date();
var lat;
var lng;
var data = [];
for (i = 0; i < N; i++) {
  lat = Math.random() * 180.0 - 90.0;
  lng = Math.random() * 360.0 - 180.0;
  data.push({ lat: lat, lng: lng, data: { lat: lat, lng: lng } });
}
tsEnd = new Date();
console.log('random data generated: ' + (tsEnd - tsStart) + 'ms');

tsStart = new Date();
tree.insert(data);
tsEnd = new Date();
console.log('data (1M) inserted into geo tree: ' + (tsEnd - tsStart) + 'ms');

var j;
var d;
for (d = 0; d < 4; d++) {
  for (j = 0; j < 3; j++) {
    for (i = 0; i < 3; i++) {
      tsStart = new Date();
      tree.find({ lat: 10.0 + (160.0 / 2) * i - 90.0, lng: 20.0 + (320.0 / 2) * j - 180.0 }, 1.0 + d * 3.0);
      tsEnd = new Date();
      console.log('find({ lat: ' + (10.0 + (160.0 / 2) * i - 90.0) +
        ', lng: ' + (20.0 + (320.0 / 2) * j - 180.0) +
        ' }, r = ' + (1.0 + d * 3.0) + '): ' + (tsEnd - tsStart) + 'ms');
    }
  }
}

console.log('\n------------------------------------------------------------\n');

var res;
tsStart = new Date();
res = tree.find({lat: 0.0, lng: 0.0}, 5.0);
tsEnd = new Date();
console.log('find({ lat: 0.0, lng: 0.0 }, 5.0): ' + (tsEnd - tsStart) + 'ms, res.length: ' + res.length);
tsStart = new Date();
res = tree.find({lat: 0.0, lng: 0.0}, 556.6, 'km');
tsEnd = new Date();
console.log('find({ lat: 0.0, lng: 0.0 }, 556.6, "km"): ' + (tsEnd - tsStart) + 'ms, res.length: ' + res.length);

console.log('\n');

tsStart = new Date();
res = tree.find({lat: 50.0, lng: 0.0}, 5.0);
tsEnd = new Date();
console.log('find({ lat: 50.0, lng: 0.0 }, 5.0): ' + (tsEnd - tsStart) + 'ms, res.length: ' + res.length);
tsStart = new Date();
res = tree.find({lat: 50.0, lng: 0.0}, 556.6, 'km');
tsEnd = new Date();
console.log('find({ lat: 50.0, lng: 0.0 }, 556.6, "km"): ' + (tsEnd - tsStart) + 'ms, res.length: ' + res.length);
