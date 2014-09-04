# Geo-tree library

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

## Build steps

TODO.

## API

TODO.

## Development

Soon(-ish), we plan to add suport for:

* `remove` opration (i.e. removing geo objects from the sets)
* cluster calculation

## Change-log

* 0.1.0 (2014-09-04): initial version (`insert`, `find` and `forEach` operations)
