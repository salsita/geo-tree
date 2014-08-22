var RBTree = require('../node.js/red-black');
var N = 1 << 20;

function benchmark(name, data, sort) {
  var i, ts_start, ts_end, tree = new RBTree();
  console.log('\ndistribution "' + name + '":');
  // insert
  ts_start = new Date();
  tree.insert(data, sort);
  ts_end = new Date();
  console.log('insert (1M) ... ' + (ts_end - ts_start) + 'ms');
  // find one
  ts_start = new Date();
  for (i = 0; i < N/4; i++) { tree.find(i * 4); }
  ts_end = new Date();
  console.log('find-one (250k) ... ' + (ts_end - ts_start) + 'ms');
  // find range
  ts_start = new Date();
  for (i = 0; i < N/1024; i++) { tree.find(i * 1024, i * 1024 + 10240); }
  ts_end = new Date();
  console.log('find-range (1k x 10k) ... ' + (ts_end - ts_start) + 'ms');
  //
  tree = null;
}

var i, arr;

arr = [];
for (i = 0; i < N; i++) { arr.push({key:i}); }
benchmark('linear', arr);

arr = [];
for (i = 0; i < N; i++) { arr.push({key: Math.floor(Math.random() * N)}); }
benchmark('random', arr);

arr = [];
for (i = 0; i < N-1; i++) { arr.push(i); }
var _arr = [], step = N, idx;
while (step > 1) {
  idx = step/2 - 1;
  while (idx < N-1) { _arr.push({key: arr[idx]}); idx += step; }
  step /= 2;
}
benchmark('binarized', _arr);

console.log('\n------------------------------------------------------------\n');

var GeoTree = require('../node.js/geo-tree');
var tree = new GeoTree();
var ts_start, ts_end;

console.log('START');
ts_start = new Date();
var lat, lng, data = [];
for (i = 0; i < N; i++) {
  lat = Math.random() * 180.0 - 90.0;
  lng = Math.random() * 360.0 - 180.0;
  data.push({lat: lat, lng: lng, data: {lat:lat, lng:lng}});
}
ts_end = new Date();
console.log('random data generated: ' + (ts_end - ts_start) + 'ms');

ts_start = new Date();
tree.insert(data);
ts_end = new Date();
console.log('data (1M) inserted into geo tree: ' + (ts_end - ts_start) + 'ms');

var j, d;
for (d = 0; d < 4; d++) {
for (j = 0; j < 3; j++) {
for (i = 0; i < 3; i++) {
ts_start = new Date();
tree.find({ lat: 10.0 + (160.0/2) * i - 90.0, lng: 20.0 + (320.0/2) * j -180.0 }, 1.0+d*3.0);
ts_end = new Date();
console.log('find({ lat: ' + (10.0 + (160.0/2) * i - 90.0)  + ', lng: ' +
                             (20.0 + (320.0/2) * j - 180.0) + ' }, r = ' +
                             (1.0+d*3.0) + '): ' + (ts_end - ts_start) + 'ms');
} } }
