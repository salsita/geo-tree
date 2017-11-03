// red-black tree implementation
//
// public API of RBTree:
// ---
// var rbt = new RBTree();  ... creates empty tree
// rbt.insert(...);         ... inserts (array of) (numeric)key-(any)value pair(s)
// rtb.find(...);           ... retuns array of values with respective keys in provided range
// rtb.forEach(cb);         ... in-order invocation of cb(value,key) on each item in the tree
// ---
// rbt.dump();              ... text dump of the tree (for debugging / testing purposes)
//

var RED = 0;
var BLACK = 1;

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
  if (typeof arg1 === 'number') {
    this._insert(arg1, arg2);
  } else if (typeof arg1 === 'object') {
    if (typeof arg1.length === 'number') {
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
        if (p.left) { p = p.left; } else { n = p.left = new RBNode(p, key, value); break; }
      } else {
        if (p.right) { p = p.right; } else { n = p.right = new RBNode(p, key, value); break; }
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
    // n RED, p RED, (u BLACK), g BLACK
    if (n === p.right && p === g.left) {
      g.left = n; n.parent = g;
      p.right = n.left
      if (p.right) { n.left.parent = p; }
      n.left = p; p.parent = n;
      n = p; p = n.parent;
    } else if (n === p.left && p === g.right) {
      g.right = n; n.parent = g;
      p.left = n.right;
      if (p.left) { n.right.parent = p; }
      n.right = p; p.parent = n;
      n = p; p = n.parent;
    }
    p.color = BLACK;
    g.color = RED;
    if (n === p.left) {
      g.left = p.right;
      if (g.left) { p.right.parent = g; }
      p.right = g;
    } else {
      g.right = p.left;
      if (g.right) { p.left.parent = g; }
      p.left = g;
    }
    pg = g.parent;
    if (pg) {
      if (g === pg.left) { pg.left = p; } else { pg.right = p; }
    } else { this.root = p; p.color = BLACK; }
    p.parent = pg; g.parent = p;
    break;
  }
};

// supported args:
// key  -- single numeric value, exact match
// start, end  -- two numberic values defining search range
RBTree.prototype.find = function(start, end) {
  if (!this.root) { return []; }
  if (end === undefined) { end = start; }
  var res = [];
  var node;
  var stack = [this.root];
  while (stack.length) {
    node = stack.pop();
    if (node.key >= start && node.key <= end) { res.push(node.values); }
    if (node.right && node.key < end) { stack.push(node.right); }
    if (node.left && node.key > start) { stack.push(node.left); }
  }
  // flatten res:
  var flatRes = [];
  var i;
  var j;
  var _ref;
  for (i = 0; i < res.length; i++) {
    _ref = res[i];
    for (j = 0; j < _ref.length; j++) { flatRes.push(_ref[j]); }
  }
  return flatRes;
};

// callback: function(data) { ... }
RBTree.prototype.forEach = function(callback) {
  function dfs(node) {
    if (!node) { return; }
    dfs(node.left);
    var ref = node.values;
    var key = node.key;
    for (var i = 0; i < ref.length; i++) { callback(ref[i], key); }
    dfs(node.right);
  }
  if (!callback) { return; }
  dfs(this.root);
};

// TODO
// supported args (key always is numeric!):
// { key: ..., value: ... }  - single object
// [ { key: ..., value: ... }, ... ]  - array of the above objects
// key  - 1 arg, value not provided
// key, value  - 2 args
// RBTree.prototype.remove = function(arg1, arg2) {
// };

// RBTree.prototype._remove = function(key) {
// };

// silent = true ... return string, else use console.log()
// not unit-testing !silent branches (using console.log)
RBTree.prototype.dump = function(silent) {
  var res = '';
  function dumpNode(node, indent) {
    if (!node) { return; }
    if (silent) {
      res += node.dump();
    } else {
      console.log(((undefined !== indent) ? indent + '+ ' : '') + node.dump());
    }
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
