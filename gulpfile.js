var fs = require('fs');
var gulp = require('gulp');
var jshint = require('gulp-jshint');
var istanbul = require('gulp-istanbul');
var mocha = require('gulp-mocha');
var browserify = require('gulp-browserify');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var symlink = require('gulp-sym');

gulp.task('lint', function(cb) {
  gulp.src(['package.json', '.jshintrc', 'gulpfile.js', 'src/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default', { verbose: false }))
    .on('finish', cb);
});

gulp.task('test', ['lint'], function (cb) {
  gulp.src('src/*.js')
    .pipe(istanbul())
    .on('finish', function () {
      gulp.src(['test/*.spec.js'])
        .pipe(mocha())
        .pipe(istanbul.writeReports({ dir: 'test/coverage', reporters: ['text','html'] }))
        .on('end', cb);
    });
});

gulp.task('default', ['test'], function() {
  var pkg = JSON.parse(fs.readFileSync('package.json'));
  gulp.src('src/' + pkg.name + '.js')
    .pipe(browserify({ debug : true, standalone: pkg['export-symbol'] }))
    .pipe(rename(pkg.name + '-' + pkg.version + '.js'))
    .pipe(gulp.dest('lib/'))
    .pipe(symlink('lib/' + pkg.name + '.js', { force: true, relative: true }))
    .pipe(uglify())
    .pipe(rename(pkg.name + '-' + pkg.version + '.min.js'))
    .pipe(gulp.dest('lib/'))
    .pipe(symlink('lib/' + pkg.name + '.min.js', { force: true, relative: true }));
});
