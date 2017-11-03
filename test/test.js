// Usage: node test
//
// Arbitrary tests, playground for testing new functions.

var GeoTree = require('../src/geo-tree');

var data = [
  { lat: 50.0791306, lng: 14.4293712, data: 'Prague' },
  { lat: 48.85837, lng: 2.294481, data: 'Paris' },
  { lat: 51.500728, lng: -0.124626, data: 'London' },
  { lat: -33.9593169, lng: 18.6741289, data: 'Cape Town' },
  { lat: 52.5075419, lng: 13.4261419, data: 'Berlin' }
];

var tree = new GeoTree();
tree.insert(data);
tree.dump();

console.log('\nfind all:\n', tree.find());
console.log('\nfind exact:\n', tree.find({ lat: -33.9593169, lng: 18.6741289 }));
console.log('\nfind radius:\n', tree.find({ lat: 49, lng: 14 }, 2));
console.log('\nfind rectangle:\n', tree.find({ lat: 45, lng: 12 }, { lat: 55, lng: 15 }));

console.log('\nforEach test:');
tree.forEach(function(value) { console.log('data:', value); });

console.log('\n------------------------------------------------------------\n');

var RBTree = require('../src/red-black');
tree = new RBTree();

for (var i = 10; i > 0; i--) { tree.insert(i, i); }
tree.dump();
console.log('\nforEach test:');
tree.forEach(function(value) { console.log('data:', value); });
