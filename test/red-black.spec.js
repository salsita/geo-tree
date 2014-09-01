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
    assert.equal(rbt.dump(true), '[k:10,c:B,#:1,l:NULL,r:NULL,p:NULL,v:[10]]');
    // [ { key: ..., value: ... }, ... ]  -- array of the above objects
    rbt.insert([{key:20, value:20}, {key:30, value:30}]);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:10,r:30,p:NULL,v:[20]]' +
        '[k:10,c:R,#:1,l:NULL,r:NULL,p:20,v:[10]]' +
        '[k:30,c:R,#:1,l:NULL,r:NULL,p:20,v:[30]]'
    );
    // key  -- 1 arg, value not provided
    rbt.insert(40);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:10,r:30,p:NULL,v:[20]]' +
        '[k:10,c:B,#:1,l:NULL,r:NULL,p:20,v:[10]]' +
        '[k:30,c:B,#:1,l:NULL,r:40,p:20,v:[30]]' +
          '[k:40,c:R,#:1,l:NULL,r:NULL,p:30,v:[null]]'
    );
    // key, value  -- 2 args
    rbt.insert(50, 50);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:10,r:40,p:NULL,v:[20]]' +
        '[k:10,c:B,#:1,l:NULL,r:NULL,p:20,v:[10]]' +
        '[k:40,c:B,#:1,l:30,r:50,p:20,v:[null]]' +
          '[k:30,c:R,#:1,l:NULL,r:NULL,p:40,v:[30]]' +
          '[k:50,c:R,#:1,l:NULL,r:NULL,p:40,v:[50]]'
    );
    // insert value with existing key --> append to existing node
    rbt.insert(40, 40);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:10,r:40,p:NULL,v:[20]]' +
        '[k:10,c:B,#:1,l:NULL,r:NULL,p:20,v:[10]]' +
        '[k:40,c:B,#:2,l:30,r:50,p:20,v:[null,40]]' +
          '[k:30,c:R,#:1,l:NULL,r:NULL,p:40,v:[30]]' +
          '[k:50,c:R,#:1,l:NULL,r:NULL,p:40,v:[50]]'
    );
    // verify left-path:
    rbt.insert({key:5, value: 500});
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:10,r:40,p:NULL,v:[20]]' +
        '[k:10,c:B,#:1,l:5,r:NULL,p:20,v:[10]]' +
          '[k:5,c:R,#:1,l:NULL,r:NULL,p:10,v:[500]]' +
        '[k:40,c:B,#:2,l:30,r:50,p:20,v:[null,40]]' +
          '[k:30,c:R,#:1,l:NULL,r:NULL,p:40,v:[30]]' +
          '[k:50,c:R,#:1,l:NULL,r:NULL,p:40,v:[50]]'
    );
    // right rotation
    rbt = new RBTree();
    rbt.insert([{key:20, value:20},{key:15, value:15},{key:30,value:30},
      {key:10,value:10},{key:18,value:18},{key:16,value:16},{key:17,value:17}]);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:15,r:30,p:NULL,v:[20]]' +
        '[k:15,c:R,#:1,l:10,r:17,p:20,v:[15]]' +
          '[k:10,c:B,#:1,l:NULL,r:NULL,p:15,v:[10]]' +
          '[k:17,c:B,#:1,l:16,r:18,p:15,v:[17]]' +
            '[k:16,c:R,#:1,l:NULL,r:NULL,p:17,v:[16]]' +
            '[k:18,c:R,#:1,l:NULL,r:NULL,p:17,v:[18]]' +
        '[k:30,c:B,#:1,l:NULL,r:NULL,p:20,v:[30]]'
    );
    // left rotation
    rbt = new RBTree();
    rbt.insert([{key:20, value:20},{key:15, value:15},{key:30,value:30},
      {key:10,value:10},{key:16,value:16},{key:18,value:18},{key:17,value:17}]);
    assert.equal(rbt.dump(true),
      '[k:20,c:B,#:1,l:15,r:30,p:NULL,v:[20]]' +
        '[k:15,c:R,#:1,l:10,r:17,p:20,v:[15]]' +
          '[k:10,c:B,#:1,l:NULL,r:NULL,p:15,v:[10]]' +
          '[k:17,c:B,#:1,l:16,r:18,p:15,v:[17]]' +
            '[k:16,c:R,#:1,l:NULL,r:NULL,p:17,v:[16]]' +
            '[k:18,c:R,#:1,l:NULL,r:NULL,p:17,v:[18]]' +
        '[k:30,c:B,#:1,l:NULL,r:NULL,p:20,v:[30]]'
    );
  });

  // TODO
});
