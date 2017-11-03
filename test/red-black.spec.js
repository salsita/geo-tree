var assert = require('assert');
var RBTree = require('../src/red-black');
var rbt, log;

// --- helpers ---

function createTestTree() {
  [99, 50, 80, 65, 70, 40, 41, 42, 48, 47, 45, 43, 55, 57, 58, 59, 60, 61, 62]
    .forEach(function(i) { rbt.insert({ key: i, value: i }); });
}

function addLog(element) {
  log.push(element);
}

// --- end of helpers ---

describe('red-black module', function() {
  beforeEach(function() { rbt = new RBTree(); log = []; });

  it('should create empty tree', function() {
    assert(rbt.dump(true) === '');
  });

  //
  // insert
  //

  it('insert (ignore invalid input)', function() {
    rbt.insert('hello world!');
    assert(rbt.dump(true) === '');
  });

  it('insert (single object)', function() {
    // single {key: ..., value: ...} object
    rbt.insert({ key: 10, value: 10 });
    assert.equal(rbt.dump(true), '[k:10,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[10]]');
  });

  it('insert (array of objects)', function() {
    // [ { key: ..., value: ... }, ... ]  -- array of the above objects
    rbt.insert([{ key: 20, value: 20 }, { key: 10, value: 10 }, { key: 30, value: 30 }]);
    assert.equal(rbt.dump(true), '[k:20,c:B,#:1,l:10,r:30,p:NULL,v:[20]][k:10,c:R,#:1,l:NULL,r:NULL,p:20,v:[10]][k:30,c:R,#:1,l:NULL,r:NULL,p:20,v:[30]]');
  });

  it('insert (single numerical value)', function() {
    // key  -- 1 arg, value not provided
    rbt.insert(40);
    assert.equal(rbt.dump(true), '[k:40,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[null]]');
  });

  it('insert (key / value numerical)', function() {
    // key, value  -- 2 args
    rbt.insert(50, 50);
    assert.equal(rbt.dump(true), '[k:50,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[50]]');
  });

  it('insert (multiple values fro the same key)', function() {
    // insert value with existing key --> append to existing node
    rbt.insert(40, 40);
    rbt.insert(40, 60);
    assert.equal(rbt.dump(true), '[k:40,c:B,#:2,l:NULL,r:NULL,p:NULL,v:[40,60]]');
  });

  it('insert (traversal code)', function() {
    rbt.insert([{ key: 10, value: 10 }, { key: 15, value: 15 }, { key: 5, value: 5 },
      { key: 1, value: 1 }, { key: 6, value: 6 }, { key: 20, value: 20 }]);
    assert.equal(rbt.dump(true),
      '[k:10,c:B,#:1,l:5,r:15,p:NULL,v:[10]]' +
        '[k:5,c:B,#:1,l:1,r:6,p:10,v:[5]]' +
          '[k:1,c:R,#:1,l:NULL,r:NULL,p:5,v:[1]]' +
          '[k:6,c:R,#:1,l:NULL,r:NULL,p:5,v:[6]]' +
        '[k:15,c:B,#:1,l:NULL,r:20,p:10,v:[15]]' +
          '[k:20,c:R,#:1,l:NULL,r:NULL,p:15,v:[20]]'
    );
  });

  it('insert (balancing)', function() {
    createTestTree();
    assert.equal(rbt.dump(true),
      '[k:55,c:B,#:1,l:45,r:65,p:NULL,v:[55]]' +
        '[k:45,c:R,#:1,l:41,r:48,p:55,v:[45]]' +
          '[k:41,c:B,#:1,l:40,r:42,p:45,v:[41]]' +
            '[k:40,c:B,#:1,l:NULL,r:NULL,p:41,v:[40]]' +
            '[k:42,c:B,#:1,l:NULL,r:43,p:41,v:[42]]' +
              '[k:43,c:R,#:1,l:NULL,r:NULL,p:42,v:[43]]' +
          '[k:48,c:B,#:1,l:47,r:50,p:45,v:[48]]' +
            '[k:47,c:B,#:1,l:NULL,r:NULL,p:48,v:[47]]' +
            '[k:50,c:B,#:1,l:NULL,r:NULL,p:48,v:[50]]' +
        '[k:65,c:R,#:1,l:58,r:80,p:55,v:[65]]' +
          '[k:58,c:B,#:1,l:57,r:60,p:65,v:[58]]' +
            '[k:57,c:B,#:1,l:NULL,r:NULL,p:58,v:[57]]' +
            '[k:60,c:R,#:1,l:59,r:61,p:58,v:[60]]' +
              '[k:59,c:B,#:1,l:NULL,r:NULL,p:60,v:[59]]' +
              '[k:61,c:B,#:1,l:NULL,r:62,p:60,v:[61]]' +
                '[k:62,c:R,#:1,l:NULL,r:NULL,p:61,v:[62]]' +
          '[k:80,c:B,#:1,l:70,r:99,p:65,v:[80]]' +
            '[k:70,c:B,#:1,l:NULL,r:NULL,p:80,v:[70]]' +
            '[k:99,c:B,#:1,l:NULL,r:NULL,p:80,v:[99]]'
    );
  });

  //
  // find
  //

  it('find (on empty tree)', function() {
    assert.equal(rbt.find(45, 59).length, 0);
  });

  it('find (exact match: not found)', function() {
    createTestTree();
    assert.equal(rbt.find(44).length, 0);
  });

  it('find (exact match: found)', function() {
    createTestTree();
    assert.equal(rbt.find(45).length, 1);
    var expect = [45, 'hello'];
    rbt.insert(45, 'hello');
    var res = rbt.find(45).sort();
    assert.equal(res.length, expect.length);
    res.forEach(function(val, idx) { assert.equal(expect[idx], val); });
  });

  it('find (range search: not found)', function() {
    createTestTree();
    assert.equal(rbt.find(12, 20).length, 0);
  });

  it('find (range search: found)', function() {
    createTestTree();
    rbt.insert(45, 'world');
    var expect = [45, 47, 48, 50, 55, 'world'];
    var res = rbt.find(45, 56).sort();
    assert.equal(res.length, expect.length);
    res.forEach(function(val, idx) { assert.equal(expect[idx], val); });
  });

  //
  // forEach
  //

  it('forEach (no callback)', function() {
    createTestTree();
    rbt.forEach();
    assert.equal(log.length, 0);
  });

  it('forEach (on empty tree)', function() {
    rbt.forEach(addLog);
    assert.equal(log.length, 0);
  });

  it('forEach (non-empty tree, valid callback)', function() {
    createTestTree();
    rbt.forEach(addLog);
    var expect = [99, 50, 80, 65, 70, 40, 41, 42, 48, 47, 45, 43, 55, 57, 58, 59, 60, 61, 62];
    expect = expect.sort();
    log = log.sort();
    assert.equal(log.length, expect.length);
    log.forEach(function(val, idx) { assert.equal(expect[idx], val); });
  });
});
