var assert = require('assert');
var GeoTree = require('../src/geo-tree');
var gt, log;

// --- helpers ---

function createTestSet() {
  /* eslint-disable key-spacing */
  gt.insert([
    { lat: -10.0, lng: -10.0, data: 'data1' },
    { lat:   0.0, lng: -10.0, data: 'data2' },
    { lat:  10.0, lng: -10.0, data: 'data3' },
    { lat: -10.0, lng:   0.0, data: 'data4' },
    { lat:   0.0, lng:   0.0, data: 'data5' },
    { lat:  10.0, lng:   0.0, data: 'data6' },
    { lat: -10.0, lng:  10.0, data: 'data7' },
    { lat:   0.0, lng:  10.0, data: 'data8' },
    { lat:  10.0, lng:  10.0, data: 'data9' }
  ]);
  /* eslint-enable key-spacing */
}

function createDistTestSet() {
  /* eslint-disable key-spacing */
  gt.insert([
    { lat: 50.0755, lng: 14.4378, data: 'Praha' },   // dist: Brno: 184.538km, Ostrava: 275.401km, Plzen: 85.023km
    { lat: 49.1951, lng: 16.6068, data: 'Brno' },    // dist: Ostrava: 138.475km, Plzen: 241.577km
    { lat: 49.8209, lng: 18.2625, data: 'Ostrava' }, // dist: Plzen: 351.482km
    { lat: 49.7384, lng: 13.3736, data: 'Plzen' }    //
  ]);
  /* eslint-enable key-spacing */
}

function addLog(element) {
  log.push(element);
}

// --- end of helpers ---

describe('geo-tree module', function() {
  beforeEach(function() { gt = new GeoTree(); log = []; });

  it('should create empty tree', function() {
    assert.equal(gt.dump(true), '');
  });

  //
  // insert
  //

  it('insert (ignore invalid input)', function() {
    gt.insert('hello world');
    assert.equal(gt.dump(true), '');
  });

  it('insert (lat, lng, data)', function() {
    gt.insert(-90.0, -180.0, 'hello');
    assert.equal(gt.dump(true),
      '[k:0,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[{"idx":0,"lat":-90,"lng":-180,"data":"hello"}]]'
    );
  });

  it('insert (single object)', function() {
    gt.insert({lat: -90.0, lng: -180.0, data: 'hello'});
    assert.equal(gt.dump(true),
      '[k:0,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[{"idx":0,"lat":-90,"lng":-180,"data":"hello"}]]'
    );
  });

  it('insert (array of objects)', function() {
    gt.insert([
      {lat: -90.0, lng: -180.0, data: 'hello'},
      {lat: -90.0, lng: -180.0, data: 'world'}
    ]);
    assert.equal(gt.dump(true),
      '[k:0,c:B,#:2,l:NULL,r:NULL,p:NULL,v:[{"idx":0,"lat":-90,"lng":-180,"data":"hello"},' +
      '{"idx":0,"lat":-90,"lng":-180,"data":"world"}]]'
    );
  });

  //
  // find
  //

  it('find (return all)', function() {
    createTestSet();
    var res = gt.find().sort();
    var expect = ['data1', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7', 'data8', 'data9'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (exact match: found)', function() {
    createTestSet();
    var res = gt.find({lat: -10.0, lng: -10.0});
    assert.equal(res.length, 1);
    assert.equal(res[0], 'data1');
  });

  it('find (exact match: not found)', function() {
    createTestSet();
    var res = gt.find({lat: -20.0, lng: -10.0});
    assert.equal(res.length, 0);
  });

  it('find (rectangle search: found)', function() {
    createTestSet();
    var res = gt.find({lat: -20.0, lng: -20.0}, {lat: 0.0, lng: 0.0}).sort();
    var expect = ['data1', 'data2', 'data4', 'data5'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (rectangle search: not found)', function() {
    createTestSet();
    var res = gt.find({lat: -7.0, lng: -7.0}, {lat: 7.0, lng: -1.0}).sort();
    assert.equal(res.length, 0);
  });

  it('find (circle search: found)', function() {
    createTestSet();
    var res = gt.find({lat: 0.0, lng: 0.0}, 10.0).sort();
    var expect = ['data2', 'data4', 'data5', 'data6', 'data8'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (circle search: not found)', function() {
    createTestSet();
    var res = gt.find({lat: 5.0, lng: 5.0}, 4.0).sort();
    assert.equal(res.length, 0);
  });

  it('find (circle search: units: m)', function() {
    createDistTestSet();
    var res = gt.find({lat: 50.0755, lng: 14.4378}, 200000.0, 'm').sort();
    var expect = ['Brno', 'Plzen', 'Praha'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (circle search: units: km)', function() {
    createDistTestSet();
    var res = gt.find({lat: 49.1951, lng: 16.6068}, 200.0, 'km').sort();
    var expect = ['Brno', 'Ostrava', 'Praha'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (circle search: units: yd)', function() {
    createDistTestSet();
    var res = gt.find({lat: 49.8209, lng: 18.2625}, 153106.0, 'yd').sort();
    var expect = ['Brno', 'Ostrava'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (circle search: units: mi)', function() {
    createDistTestSet();
    var res = gt.find({lat: 49.7384, lng: 13.3736}, 56.0, 'mi').sort();
    var expect = ['Plzen', 'Praha'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  it('find (circle search: units: unknown)', function() {
    createDistTestSet();
    var res = gt.find({lat: 50.0755, lng: 14.4378}, 2.8, 'hello world').sort();
    var expect = ['Brno', 'Plzen', 'Praha'];
    assert.equal(res.length, expect.length);
    expect.forEach(function(val, idx) { assert.equal(res[idx], val); });
  });

  //
  // forEach
  //

  it('forEach (no callback)', function() {
    createTestSet();
    gt.forEach();
    assert.equal(log.length, 0);
  });

  it('forEach (on empty set)', function() {
    gt.forEach(addLog);
    assert.equal(log.length, 0);
  });

  it('forEach (non-empty set, valid callback)', function() {
    createTestSet();
    gt.forEach(addLog);
    var expect = ['data1', 'data2', 'data3', 'data4', 'data5', 'data6', 'data7', 'data8', 'data9'];
    log = log.sort();
    assert.equal(log.length, expect.length);
    log.forEach(function(val, idx) { assert.equal(expect[idx], val); });
  });
});
