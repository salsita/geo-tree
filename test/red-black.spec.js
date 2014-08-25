var assert = require('assert');
var RBTree = require('../src/red-black');
var rbt;

describe('red-black module', function() {

  it('should create empty tree', function() {
    rbt = new RBTree();
    assert(rbt.dump(true) === '');
  });

  it('should test insert function', function() {
    // single {key: ..., value: ...} object
    rbt.insert({key:10, value:10});
    assert(rbt.dump(true) === '[k:10,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[10]]');
    // TODO
  });

  // TODO
});
