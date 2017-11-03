[![Dependency Status](https://img.shields.io/david/salsita/geo-tree.svg)](https://david-dm.org/salsita/geo-tree)
[![devDependency Status](https://img.shields.io/david/dev/salsita/geo-tree.svg)](https://david-dm.org/salsita/geo-tree?type=dev)
![Downloads](https://img.shields.io/npm/dm/geo-tree.svg?style=flat)
![Licence](https://img.shields.io/npm/l/geo-tree.svg?style=flat)
[![Known Vulnerabilities](https://snyk.io/test/github/salsita/geo-tree/badge.svg)](https://snyk.io/test/github/salsita/geo-tree)

# geo-tree library

Geo-tree library is a tool for working with map objects. The primary use-case is
creating a set of map-related objects (i.e. each of them having its latitude,
longitude and data), followed with a queries to find objects in given area
(exact match / rectangular area / circle area).

The existing code we used for this purpose originally (that was part of (one of
the many available) google map directives) was not performant enough
(it scanned the whole set of objects sequentially each time), so our goal was to
speed the find queries using some clever data structures and algorithms.

After some prototyping and testing, we decided to wrap our `GeoTree`
implementation around red-black binary search trees using z-curve algorithm for
converting 2D plane coordinates into scalar index (and using this index as the
numeric key in underlaying red-black tree).

This way, the `find()` operation doesn't need to go through the whole list, but
we can eliminate a lot of items for which we know in advance that we don't need
to consider them based on provided search criteria.

So when using hundreds or thousands or even more objects in your map application
and having performance issues, may find this library very useful.

## Installation

```
$ npm i geo-tree
```

## API

### Constructor

The `GeoTree` constructor function is the only exported library symbol.  
You require it as:
```
const GeoTree = require('geo-tree');
```

To create new empty set (tree), do:
```
const set = new GeoTree();
```

### Insert

To insert geo-related items into the `set`, use `insert()` function. Each
inserted item must have latitude `lat`, longitude `lng`, and associated data
`data`.

Supported ranges:
* `lat`: `-90.0` .. `+90.0`
* `lng`: `-180.0` .. `+180.0`
* `data`: any value

Assume we want to insert:
```
lat: 48.85886, lng:  2.34706, data: 'Paris, France'
lat: 52.50754, lng: 13.42614, data: 'Berlin, Germany'
lat: 50.05967, lng: 14.46562, data: 'Prague, Czech Republic'
```

Function `insert()` can be invoked with single parameter: object
```
{
  lat: ...,
  lng: ...,
  data: ...
}
```

So you would invoke it 3 times to insert the above 3 items, inserting one each
time, e.g. to insert Paris, you'd do:
```
set.insert({lat: 48.85886, lng: 2.34706, data: 'Paris, France'});
```

For bulk insert, you can pass an array of the above mentioned objects, they will
be inserted sequentially. So to insert all 3 of them in one `insert()`
invocation, you'd do:
```
set.insert([
  {lat: 48.85886, lng:  2.34706, data: 'Paris, France'},
  {lat: 52.50754, lng: 13.42614, data: 'Berlin, Germany'},
  {lat: 50.05967, lng: 14.46562, data: 'Prague, Czech Republic'}
]);
```

Last option is to pass `lat`, `lng` and `data` as 3 arguments to `insert()`,
which will insert one item with associated coordinates and data. E.g. to insert
Prague, you'd do:
```
set.insert(50.05967, 14.46562, 'Prague, Czech Republic');
```

There is no need to have unique `lat`, `lng` pairs when inserting the items.

### Find

To find items based on some geographical relation, use `find()` function. The
function returns *array* of `data` fields of inserted items.

The order in which you'll get the found items in the resulting array is
determined by underlaying red-black tree, so do not expect to see the `data`
fields to be in any specific order.

With no argument, i.e. `set.find()`, the function returns array of the `data`
field of *all* the inserted items.

```
set.find();
// --> ['Prague, Czech Republic', 'Paris, France', 'Berlin, Germany']
```

Specifying single object argument `{lat: ..., lng: ...}`, the function returns
`data` fields of items that match the position exactly.

```
set.find({lat: 48.85886, lng: 2.34706});
// --> ['Paris, France']
```

You can pass two `lat`/`lng` objects to `find()`, in which case it will return
`data` fields of the items in rectangle defined by the two coordinates (the
arguments are treated as two diagonal vertices of a rectangle).

```
set.find({lat: 45, lng: 0}, {lat: 55, lng: 14});
// --> ['Paris, France', 'Berlin, Germany']
```

Finally, you can pass one `lat`/`lng` object, a float number, and optionally a
string. These parameters are making up a circle (with provided center and
radius) in which you search for the items. If you don't provide the third string
argument, the units for the provided radius value are native to latitude and
longitude (i.e. angle degrees). If you want to specify different units for
radius, select one of the following: `m` for meters, `km` for kilometers, `yd`
for yards, and `mi` for miles. In case you pass any other string, it is ignored
and the value is not converted.

```
set.find({lat: 51, lng: 14}, 2.0);
// --> ['Prague, Czech Republic', 'Berlin, Germany']

set.find({lat: 51, lng: 17}, 200.0, 'mi');
// --> ['Prague, Czech Republic', 'Berlin, Germany']
```

### Iteration over all items

`GeoTree` supports `forEach` method to which you pass a callback that takes
single argument. We iterate over all items in the set and invoke provided
callback, passing `data` field of the item.

```
set.forEach(function(data) { console.log(data); });
/* prints to console:
     Paris, France
     Prague, Czech Republic
     Berlin, Germany
*/
```

Same as for the `find()` method: the order passed `data` items to the callback
is determined by underlaying red-black tree structure, so do not expect to see
the callbacks invoked in any particular order.

### For debugging: dump    

For debugging purposes and for the purposes of unit tests, there is `dump()`
method that either prints the internal representation of the current stored set
to the console (no argument, or falsey argument passed), or generates a string
that describes the the tree (single truthy argument passed).

## Working from source code

```
$ git clone git@github.com:salsita/geo-tree.git
$ cd geo-tree
$ npm i
$ npm test
```

Eslint is used for linting the source code, and jest as the test runner. The test coverage report
is stored in `coverage` directory after testing.

There are also two additional test files in `test` directory:
* `benchmark.js`: run it before you make changes to the source code, and then after, to see
the performance impact of your change,
* `test.js`: playground for your new feature(s).

To run them, just do
```
$ node test/benchmark
```
and 
```
$ node test/test
```

## Change-log

* 1.0.1 (2017-11-03): Major rework of infrastructure (gulp no more, jest, eslint, ...)
* 0.1.4 (2014-10-27): Gulp build system replaced Grunt
* 0.1.3 (2014-10-21): Repo migrated from my private account to salsita account
* 0.1.2 (2014-10-12): Haversine function for radius verifications
* 0.1.1 (2014-09-16): support for m/km/yd/mi radius value for circle-search operation
* 0.1.0 (2014-09-04): initial version (`insert`, `find` and `forEach` operations)

## MIT License

Copyright (c) 2014-2017 Salsita Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
